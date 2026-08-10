const fs = require('fs');
const { execFileSync } = require('child_process');
const { logger } = require('./logger');

/**
 * Running things OUTSIDE the sandbox, when GitBox is installed as a Flatpak.
 *
 * Inside the sandbox the only filesystem GitBox sees is the runtime's: none of
 * the user's editors, diff tools or terminal emulators are on PATH, and the
 * login shell is the runtime's /bin/bash rather than the user's. So the
 * Settings pickers come up empty and "open external terminal" has nothing to
 * launch — not because the tools are missing, but because we cannot see them.
 *
 * `flatpak-spawn --host` runs a command on the host instead. It is part of the
 * runtime, but reaching the host needs `--talk-name=org.freedesktop.Flatpak` in
 * the manifest's finish-args; without it every call fails. Nothing here throws
 * in that case — `usable()` goes false once and every caller falls back to the
 * in-sandbox behaviour, which is what a Flatpak without the permission had all
 * along.
 *
 * Outside a Flatpak `usable()` is false and none of this is on the path.
 */

// FLATPAK_ID is exported into the sandbox; /.flatpak-info exists there too and
// survives a caller that scrubs the environment.
const inFlatpak = !!process.env.FLATPAK_ID || fs.existsSync('/.flatpak-info');

let hostReachable = null;   // null = not probed yet
let cachedShell = null;
const commandCache = new Map();

// Single-quote for /bin/sh: everything is literal inside single quotes, so only
// the quote itself has to be broken out.
const quote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function runOnHost(argv, timeout = 5000) {
    try {
        return execFileSync('flatpak-spawn', ['--host', ...argv], {
            encoding: 'utf8',
            timeout,
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } catch (e) {
        return null;
    }
}

/** True when commands can actually be run on the host. Probed once. */
function usable() {
    if (!inFlatpak) return false;
    if (hostReachable === null) {
        hostReachable = runOnHost(['true'], 3000) !== null;
        logger[hostReachable ? 'info' : 'warn'](
            hostReachable
                ? '[Host] flatpak-spawn --host is available; external tools resolve against the host'
                : '[Host] flatpak-spawn --host is unavailable (no org.freedesktop.Flatpak permission); external tools stay hidden'
        );
    }
    return hostReachable;
}

/** The user's login shell as the HOST knows it, not the runtime's. */
function loginShell() {
    if (cachedShell) return cachedShell;
    const out = usable() ? runOnHost(['sh', '-c', 'printf %s "$SHELL"'], 3000) : null;
    const value = out && out.trim();
    cachedShell = value && value.startsWith('/') ? value : '/bin/bash';
    return cachedShell;
}

/**
 * Resolves a batch of command names on the host in ONE round trip and caches
 * the answers.
 *
 * One trip matters: the Settings pickers probe about forty commands, and a
 * login shell costs a couple hundred milliseconds to start — forty of those is
 * a visible stall, one is not.
 *
 * The shell is interactive AND login for the same reason augmentedPath() spawns
 * one outside the sandbox: plenty of people put their PATH in .zshrc or hand it
 * to mise/asdf, and a non-interactive shell never reads those files. Its output
 * is fenced because those same files print banners.
 */
function primeCommands(commands) {
    if (!usable()) return;

    const missing = [...new Set(commands.filter(c => c && !commandCache.has(c)))];
    if (!missing.length) return;

    const probes = missing
        .map(c => `command -v ${quote(c)} >/dev/null 2>&1 && printf '%s\\n' ${quote(c)}`)
        .join('; ');

    const out = runOnHost(
        [loginShell(), '-lic', `printf '__GITBOX_BEGIN__\\n'; ${probes}; printf '__GITBOX_END__\\n'`],
        15000
    );

    const fenced = /__GITBOX_BEGIN__\n([\s\S]*?)__GITBOX_END__/.exec(out || '');
    const found = new Set(
        fenced ? fenced[1].split('\n').map(l => l.trim()).filter(Boolean) : []
    );

    // A probe that never answered is cached as "absent" all the same: the shell
    // timed out or the permission went away, and retrying it per lookup would
    // stall every picker that asks.
    for (const c of missing) commandCache.set(c, found.has(c));
}

/** Whether `cmd` exists on the host. Primes it alone if not already batched. */
function hasCommand(cmd) {
    if (!usable() || !cmd) return false;
    if (!commandCache.has(cmd)) primeCommands([cmd]);
    return commandCache.get(cmd) === true;
}

/**
 * Rewrites a spawn into its host equivalent: `[file, args]` to hand to
 * child_process.spawn or pty.spawn. Returns the command untouched when the host
 * is out of reach, so callers never branch twice.
 *
 * `cwd` becomes --directory because the sandbox path and the host path can be
 * the same string yet the process runs on the other side of the boundary; env
 * has to be forwarded explicitly for the same reason.
 */
function spawnArgs(cmd, args = [], { cwd, env } = {}) {
    if (!usable()) return [cmd, args];

    const prefix = ['--host'];
    if (cwd) prefix.push(`--directory=${cwd}`);
    for (const [k, v] of Object.entries(env || {})) prefix.push(`--env=${k}=${v}`);

    return ['flatpak-spawn', [...prefix, cmd, ...args]];
}

module.exports = { inFlatpak, usable, loginShell, primeCommands, hasCommand, spawnArgs };

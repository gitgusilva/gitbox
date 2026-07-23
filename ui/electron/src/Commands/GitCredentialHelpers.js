/**
 * @fileoverview Reuse of the credentials a user already configured for git.
 *
 * libgit2 does not implement git's credential-helper protocol (its
 * `credential_helpers.h` is only a stock userpass callback), so GitBox speaks it
 * directly: read `credential.*` from the user's git config — natively, via
 * libgit2, never by shelling out to the git CLI — then run the configured helper
 * and read back the username/password it prints.
 *
 * SECURITY: helpers are taken from the GLOBAL and SYSTEM config only, never from
 * a repository's own .git/config. A helper spec is a command line, and repo
 * config travels with a clone — honouring it would let any repository GitBox
 * opens run an arbitrary command. Real setups configure helpers globally
 * (`gh auth setup-git`, `git config --global credential.helper manager`), so
 * nothing legitimate is lost.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** A helper that waits on a GUI prompt would hang fetch/push forever. Give up
 *  and fall through to the app's own credentials instead. */
const HELPER_TIMEOUT_MS = 5000;

/** Where git's own helper binaries live when git is installed but not on PATH. */
const GIT_CORE_DIRS = [
    '/usr/libexec/git-core',
    '/usr/lib/git-core',
    '/usr/local/libexec/git-core',
    '/opt/homebrew/libexec/git-core',
    'C:\\Program Files\\Git\\mingw64\\libexec\\git-core',
];

/** Splits a remote URL into the fields the credential protocol expects. */
function parseUrl(remoteUrl) {
    const u = String(remoteUrl || '');
    const m = u.match(/^([a-z+]+):\/\/(?:([^@/]*)@)?([^/]+)(\/.*)?$/i);
    if (!m) return null;
    const [, protocol, userInfo, hostPort, rest] = m;
    return {
        protocol: protocol.toLowerCase(),
        host: hostPort.toLowerCase(),                        // host[:port], as git sends it
        path: (rest || '').replace(/^\//, '').replace(/\.git$/i, ''),
        username: userInfo ? userInfo.split(':')[0] : '',
    };
}

/**
 * Does a `credential.<url>.helper` scope apply to this remote?
 * Follows gitcredentials(5): protocol and host must match exactly (a config
 * entry with no port matches any port is NOT true — git compares host:port),
 * and the config path, when present, must be a path prefix of the request.
 */
function scopeMatches(scopeUrl, target) {
    const scope = parseUrl(scopeUrl.includes('://') ? scopeUrl : `https://${scopeUrl}`);
    if (!scope) return false;
    if (scope.protocol !== target.protocol || scope.host !== target.host) return false;
    if (!scope.path) return true;
    return target.path === scope.path || target.path.startsWith(`${scope.path}/`);
}

/**
 * The ordered helper chain for a URL, as git would assemble it.
 * `credential.helper` entries apply to every remote; `credential.<url>.helper`
 * only to matching ones. An entry with an EMPTY value resets the chain — that is
 * git's documented way to discard helpers configured at a broader scope, and
 * `gh auth setup-git` writes exactly that pair.
 */
function helperChain(addon, remoteUrl) {
    const target = parseUrl(remoteUrl);
    if (!target) return [];

    let entries = [];
    try {
        entries = addon.configEntries('', '^credential\\.') || [];
    } catch (e) {
        return [];
    }

    const chain = [];
    for (const entry of entries) {
        const name = String(entry.name || '');
        if (!name.endsWith('.helper')) continue;

        const middle = name.slice('credential.'.length, -'.helper'.length);
        if (middle && !scopeMatches(middle, target)) continue;

        const value = String(entry.value || '').trim();
        if (!value) { chain.length = 0; continue; }   // documented reset
        chain.push(value);
    }
    return chain;
}

/** Resolves a helper spec to something runnable. */
function commandFor(spec) {
    if (spec.startsWith('!')) {
        // Shell form. `gh auth setup-git` writes "!/usr/bin/gh auth git-credential",
        // so this is the common case, not an exotic one.
        const command = spec.slice(1);
        return process.platform === 'win32'
            ? { file: 'cmd.exe', args: ['/c', `${command} get`] }
            : { file: '/bin/sh', args: ['-c', `${command} get`] };
    }
    if (path.isAbsolute(spec) || spec.includes('/') || spec.includes('\\')) {
        const [file, ...rest] = spec.split(/\s+/);
        return { file, args: [...rest, 'get'] };
    }
    // Bare name: git looks for git-credential-<name> on PATH.
    const [name, ...rest] = spec.split(/\s+/);
    const binary = `git-credential-${name}`;
    for (const dir of GIT_CORE_DIRS) {
        const candidate = path.join(dir, binary);
        try {
            if (fs.existsSync(candidate)) return { file: candidate, args: [...rest, 'get'] };
        } catch (e) { /* unreadable dir — try the next */ }
    }
    return { file: binary, args: [...rest, 'get'] };
}

/** Runs one helper and returns whatever credentials it printed. */
function runHelper(spec, target) {
    return new Promise((resolve) => {
        let cmd;
        try { cmd = commandFor(spec); } catch (e) { return resolve(null); }

        let child;
        try {
            child = spawn(cmd.file, cmd.args, { stdio: ['pipe', 'pipe', 'ignore'] });
        } catch (e) {
            return resolve(null);
        }

        let out = '';
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { child.kill(); } catch (e) { /* already gone */ }
            resolve(value);
        };
        const timer = setTimeout(() => finish(null), HELPER_TIMEOUT_MS);

        child.stdout.on('data', (chunk) => { out += chunk.toString(); });
        child.on('error', () => finish(null));
        child.on('close', () => {
            const fields = {};
            for (const line of out.split('\n')) {
                const idx = line.indexOf('=');
                if (idx > 0) fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
            finish(fields.password ? { username: fields.username || '', token: fields.password } : null);
        });

        // The request block, terminated by a blank line, is what git writes.
        const request =
            `protocol=${target.protocol}\n` +
            `host=${target.host}\n` +
            (target.path ? `path=${target.path}\n` : '') +
            (target.username ? `username=${target.username}\n` : '') +
            '\n';
        child.stdin.on('error', () => finish(null));   // helper exited before reading
        child.stdin.end(request);
    });
}

/**
 * Last-resort read of `~/.git-credentials`, the file the built-in `store` helper
 * uses. Covers machines where git isn't installed at all, so the
 * git-credential-store binary that would normally answer this doesn't exist —
 * GitBox ships its own git, so that combination is entirely normal here.
 */
function readStoreFile(target) {
    const files = [
        path.join(os.homedir(), '.git-credentials'),
        path.join(os.homedir(), '.config', 'git', 'credentials'),
    ];
    for (const file of files) {
        let content;
        try { content = fs.readFileSync(file, 'utf-8'); } catch (e) { continue; }
        for (const line of content.split('\n')) {
            const entry = parseUrl(line.trim());
            if (!entry || !entry.username) continue;
            if (entry.protocol !== target.protocol || entry.host !== target.host) continue;
            const creds = line.trim().match(/^[a-z+]+:\/\/([^@/]*)@/i);
            if (!creds) continue;
            const [user, ...pass] = creds[1].split(':');
            const token = pass.join(':');
            if (!token) continue;
            return { username: decodeURIComponent(user), token: decodeURIComponent(token) };
        }
    }
    return null;
}

/**
 * Credentials git would use for this remote, or null when it has none.
 * @param {object} addon  native addon (needs configEntries)
 * @param {string} remoteUrl
 * @returns {Promise<{username: string, token: string, helper: string}|null>}
 */
async function credentialsFromGit(addon, remoteUrl) {
    const target = parseUrl(remoteUrl);
    if (!target) return null;

    for (const spec of helperChain(addon, remoteUrl)) {
        const found = await runHelper(spec, target);
        if (found) return { ...found, helper: spec };
        // The built-in `store` helper has no binary when git isn't installed.
        if (/^store\b/.test(spec)) {
            const stored = readStoreFile(target);
            if (stored) return { ...stored, helper: 'store' };
        }
    }
    return null;
}

module.exports = { credentialsFromGit, helperChain, parseUrl, scopeMatches, readStoreFile };

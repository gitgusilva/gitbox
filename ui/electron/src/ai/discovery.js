const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync, execFile } = require('child_process');
const { promisify } = require('util');
const { AI_CLIS } = require('./registry');

const execFileAsync = promisify(execFile);
const fsp = fs.promises;

/** Resolve a command via the OS PATH (which/where). Returns the first hit. */
function whichPath(cmd) {
    try {
        const finder = process.platform === 'win32' ? 'where' : 'which';
        const out = execFileSync(finder, [cmd], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        return out.split(/\r?\n/)[0] || null;
    } catch {
        return null;
    }
}

/**
 * Directories where CLIs commonly land but which may not be on the PATH the
 * Electron process inherited (GUI apps often get a minimal PATH). Covers npm/pnpm
 * global bins, Homebrew, Cargo, Bun, Deno, Volta, pipx, snap, and Windows equivs.
 */
function candidateDirs() {
    const home = os.homedir();
    const dirs = [];

    if (process.platform === 'win32') {
        const appdata = process.env.APPDATA || '';
        const localApp = process.env.LOCALAPPDATA || '';
        dirs.push(
            path.join(appdata, 'npm'),
            path.join(localApp, 'pnpm'),
            path.join(home, '.bun', 'bin'),
            path.join(home, '.deno', 'bin'),
            path.join(home, '.cargo', 'bin'),
            path.join(home, '.local', 'bin')
        );
    } else {
        dirs.push(
            '/usr/local/bin',
            '/usr/bin',
            '/bin',
            '/opt/homebrew/bin',
            '/home/linuxbrew/.linuxbrew/bin',
            '/snap/bin',
            path.join(home, '.local', 'bin'),
            path.join(home, 'bin'),
            path.join(home, '.npm-global', 'bin'),
            path.join(home, '.local', 'share', 'pnpm'),
            path.join(home, '.bun', 'bin'),
            path.join(home, '.deno', 'bin'),
            path.join(home, '.cargo', 'bin'),
            path.join(home, '.volta', 'bin'),
            path.join(home, 'node_modules', '.bin')
        );
    }
    return dirs;
}

const WIN_EXTS = ['.cmd', '.exe', '.bat', '.ps1', ''];

/** Find an executable by name: PATH first, then the common install dirs. */
function findBinary(bins) {
    for (const cmd of bins) {
        const w = whichPath(cmd);
        if (w) return w;
    }
    const exts = process.platform === 'win32' ? WIN_EXTS : [''];
    for (const dir of candidateDirs()) {
        for (const cmd of bins) {
            for (const ext of exts) {
                const p = path.join(dir, cmd + ext);
                try {
                    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
                } catch {
                    /* ignore */
                }
            }
        }
    }
    return null;
}

/** Discover every registered AI CLI that's actually installed (synchronous). */
function discoverAiClis() {
    const found = [];
    for (const entry of AI_CLIS) {
        const bin = findBinary(entry.bins);
        if (bin) {
            found.push({ id: entry.id, label: entry.label, vendor: entry.vendor, path: bin });
        }
    }
    return found;
}

/** Async, non-blocking `which` — resolves a command via the OS PATH. */
async function whichPathAsync(cmd) {
    try {
        const finder = process.platform === 'win32' ? 'where' : 'which';
        const { stdout } = await execFileAsync(finder, [cmd], { windowsHide: true });
        return stdout.toString().trim().split(/\r?\n/)[0] || null;
    } catch {
        return null;
    }
}

/** Async twin of findBinary: PATH first, then the common install dirs. */
async function findBinaryAsync(bins) {
    for (const cmd of bins) {
        const w = await whichPathAsync(cmd);
        if (w) return w;
    }
    const exts = process.platform === 'win32' ? WIN_EXTS : [''];
    for (const dir of candidateDirs()) {
        for (const cmd of bins) {
            for (const ext of exts) {
                const p = path.join(dir, cmd + ext);
                try {
                    const st = await fsp.stat(p);
                    if (st.isFile()) return p;
                } catch {
                    /* ignore */
                }
            }
        }
    }
    return null;
}

// The discovery result is stable for a session (CLIs don't get installed while
// the app runs, in practice), and the scan spawns ~16 `which` processes — so
// memoize it. The Settings > Integrations tab called this on every open, blocking
// the main process each time; now it runs once, off the event loop.
let discoverCache = null;

/** Async, cached discovery of installed AI CLIs. Pass force=true to rescan. */
async function discoverAiClisAsync(force = false) {
    if (discoverCache && !force) return discoverCache;
    const results = await Promise.all(AI_CLIS.map(async (entry) => {
        const bin = await findBinaryAsync(entry.bins);
        return bin ? { id: entry.id, label: entry.label, vendor: entry.vendor, path: bin } : null;
    }));
    discoverCache = results.filter(Boolean);
    return discoverCache;
}

/** Resolve the executable path + run args for a given CLI id, or null. */
function resolveAiCli(id) {
    const entry = AI_CLIS.find(c => c.id === id);
    if (!entry) return null;
    const bin = findBinary(entry.bins);
    if (!bin) return null;
    return { path: bin, runArgs: entry.runArgs, promptAsArg: !!entry.promptAsArg };
}

module.exports = { discoverAiClis, discoverAiClisAsync, resolveAiCli, findBinary };

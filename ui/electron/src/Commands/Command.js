const { exec, execFile } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);

/** Strips credentials embedded in URLs (https://user:token@host) before a
 *  command string is logged/emitted to the renderer, so tokens never leak. */
function redactCredentials(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/(\bhttps?:\/\/)[^/@\s]+@/gi, '$1***@');
}

/**
 * Base Git Command Class
 */
class Command {
    constructor(addon = null) {
        this.addon = addon;
    }

    /**
     * Runs `git` WITHOUT a shell, passing arguments as an argv array. Because no
     * /bin/sh is involved, user-controlled values (branch names, messages, paths,
     * URLs) can never be interpreted as shell syntax — this is the injection-safe
     * replacement for execAsync and should be used for every git call.
     * @param {string} repoPath  working directory
     * @param {string[]} args    argv for git, e.g. ['stash','save',message]
     * @param {object} options   passed to execFile (encoding, maxBuffer, timeout…),
     *   plus `probe: true` for calls whose failure is expected and handled by the
     *   caller. A probe never reaches the Command Log — the log is emitted before
     *   the caller's catch runs, so without this a swallowed failure still shows
     *   the user a red entry for something that did not go wrong.
     */
    async execGit(repoPath, args, options = {}) {
        const { probe = false, ...execOptions } = options;
        const start = Date.now();
        const display = 'git ' + args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ');
        try {
            const result = await execFileAsync('git', args, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, ...execOptions });
            if (!probe) {
                this.emitLog(repoPath, redactCredentials(display), result.stdout, result.stderr, Date.now() - start, 0);
            }
            return result;
        } catch (error) {
            if (!probe) {
                this.emitLog(repoPath, redactCredentials(display), '', error.message, Date.now() - start, error.code || 1);
            }
            throw error;
        }
    }

    /**
     * Keeps only the paths git still reports as changed.
     *
     * The renderer sends a selection captured when the file list was rendered. By
     * the time the command runs a path may be gone — discarded, stashed from
     * another tab, deleted on disk. Git answers a stale pathspec with
     * "pathspec ':(prefix:0)<path>' did not match any files", and for commands
     * like `stash push` it does so AFTER having acted on the valid paths: the
     * operation half succeeds while reporting failure. Dropping them up front is
     * what keeps that from happening.
     *
     * @returns {Promise<string[]>} the subset of `requested` that is still live
     */
    async livePaths(repoPath, requested) {
        const wanted = (Array.isArray(requested) ? requested : [requested]).filter(Boolean);
        if (wanted.length === 0) return [];

        const { stdout } = await this.execGit(repoPath, ['status', '--porcelain', '-z'], { probe: true });
        const tokens = stdout.split('\0').filter(Boolean);
        const live = new Set();

        for (let i = 0; i < tokens.length; i += 1) {
            const entry = tokens[i];
            const code = entry.slice(0, 2);
            live.add(entry.slice(3));
            // A rename/copy entry is followed by its ORIGINAL path as a bare token
            // (no status prefix) — consume it here so it isn't mis-parsed as an
            // entry, and accept it too since the UI may list either side.
            if (code[0] === 'R' || code[0] === 'C') {
                i += 1;
                if (tokens[i]) live.add(tokens[i]);
            }
        }

        return wanted.filter(p => live.has(p));
    }

    /**
     * @deprecated Runs a command through /bin/sh — vulnerable to injection if any
     * argument is user-controlled. Kept only for fixed, argument-free commands.
     * Prefer execGit().
     */
    async execAsync(repoPath, cmd, options = {}) {
        const start = Date.now();
        try {
            const result = await execAsync(cmd, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, ...options });
            const duration = Date.now() - start;
            this.emitLog(repoPath, redactCredentials(cmd), result.stdout, result.stderr, duration, 0);
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            this.emitLog(repoPath, redactCredentials(cmd), '', error.message, duration, error.code || 1);
            throw error;
        }
    }

    /**
     * Emits a log entry to the main window
     */
    emitLog(repoPath, cmd, stdout, stderr, duration, exitCode) {
        try {
            const { getMainWindow } = require('../windows/index');
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('git:log-entry', repoPath, cmd, stdout, stderr, duration, exitCode);
            }
        } catch (e) {
            // Silently fail if window not available
        }
    }

    /**
     * Checks if a filename refers to an image
     * @param {string} f 
     */
    isImage(f) {
        return /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(f);
    }
}

module.exports = Command;

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
     * @param {object} options   passed to execFile (encoding, maxBuffer, timeout…)
     */
    async execGit(repoPath, args, options = {}) {
        const start = Date.now();
        const display = 'git ' + args.map(a => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ');
        try {
            const result = await execFileAsync('git', args, { cwd: repoPath, maxBuffer: 1024 * 1024 * 10, ...options });
            const duration = Date.now() - start;
            this.emitLog(repoPath, redactCredentials(display), result.stdout, result.stderr, duration, 0);
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            this.emitLog(repoPath, redactCredentials(display), '', error.message, duration, error.code || 1);
            throw error;
        }
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

/**
 * @fileoverview Per-file actions surfaced from the "Local Changes" context menu:
 * open with default app, reveal in file manager, stash/assume-unchanged a single
 * file, export its patch, and query its commit history.
 */
const { shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const Command = require('./Command');

const US = '\x1f';

class FileActions extends Command {
    /** Open a path with the OS default application. */
    async openPath(fullPath) {
        const err = await shell.openPath(fullPath);
        return !err;
    }

    /** Reveal a path in the OS file manager (Finder / Explorer / Files). */
    revealInFolder(fullPath) {
        shell.showItemInFolder(fullPath);
        return true;
    }

    /** Toggle git's assume-unchanged bit for a file. */
    async assumeUnchanged(repoPath, filePath, assume = true) {
        const flag = assume ? '--assume-unchanged' : '--no-assume-unchanged';
        await this.execGit(repoPath, ['update-index', flag, '--', filePath]);
        return true;
    }

    /**
     * Stash a specific set of files (keeps the rest of the working tree intact).
     * @param {string|string[]} filePath one path or a list of paths to stash together
     * @param {string} message stash message (optional)
     * @param {{ keepIndex?: boolean, includeUntracked?: boolean }} [options]
     *   keepIndex → leave staged changes in the index; includeUntracked → also stash untracked files.
     */
    /**
     * Stashes only the given paths.
     *
     * The selection is re-checked against the live status first. A path that git
     * no longer reports — the file was deleted, discarded, or already stashed
     * from another tab since the UI last refreshed — makes `git stash push`
     * create the stash for the remaining paths and THEN exit 1 with
     * "pathspec ':(prefix:0)<path>' did not match any files". The operation half
     * succeeds while the app reports a failure, so the stale paths are dropped
     * before git ever sees them.
     */
    async stashFile(repoPath, filePath, message = '', options = {}) {
        const paths = await this.livePaths(repoPath, filePath);
        if (paths.length === 0) {
            // Nothing left to stash: report it as a no-op, not as a git failure.
            return false;
        }

        const args = ['stash', 'push'];
        if (options && options.keepIndex) args.push('--keep-index');
        if (options && options.includeUntracked) args.push('--include-untracked');
        if (message) args.push('-m', message);
        args.push('--', ...paths);
        await this.execGit(repoPath, args);
        return true;
    }

    /**
     * Export the diff of one or more files as a single `.patch` via a native save dialog.
     * @param {string|string[]} filePath one path or a list of paths to include
     * @param {boolean} staged diff the staged version instead of the working tree
     * @returns {{ saved: boolean, path?: string }}
     */
    async savePatch(repoPath, filePath, staged = false) {
        const paths = (Array.isArray(filePath) ? filePath : [filePath]).filter(Boolean);
        if (paths.length === 0) return { saved: false };

        const args = ['diff'];
        if (staged) args.push('--cached');
        args.push('--', ...paths);
        const { stdout } = await this.execGit(repoPath, args);

        const defaultName = paths.length === 1
            ? `${path.basename(paths[0])}.patch`
            : `${path.basename(repoPath) || 'changes'}-${paths.length}-files.patch`;
        const { getMainWindow } = require('../windows/index');
        const win = getMainWindow();
        const { canceled, filePath: target } = await dialog.showSaveDialog(win, {
            title: 'Save Patch',
            defaultPath: path.join(repoPath, defaultName),
            filters: [{ name: 'Patch', extensions: ['patch', 'diff'] }],
        });
        if (canceled || !target) return { saved: false };

        await fs.promises.writeFile(target, stdout, 'utf8');
        return { saved: true, path: target };
    }

    /** Save arbitrary text via a native save dialog (used for theme export). */
    async saveTextFile(defaultName, content) {
        const { getMainWindow } = require('../windows/index');
        const win = getMainWindow();
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
            title: 'Save File',
            defaultPath: defaultName,
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !filePath) return { saved: false };
        await fs.promises.writeFile(filePath, content, 'utf8');
        return { saved: true, path: filePath };
    }

    /** Fetch a remote text resource over HTTPS (used for the theme registry). */
    async fetchText(url) {
        if (!/^https:\/\//i.test(String(url))) throw new Error('Only https URLs are allowed');
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    }

    /** Open a text file via a native open dialog (used for theme import). */
    async openTextFile() {
        const { getMainWindow } = require('../windows/index');
        const win = getMainWindow();
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Open File',
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !filePaths || !filePaths.length) return null;
        const content = await fs.promises.readFile(filePaths[0], 'utf8');
        return { content, path: filePaths[0] };
    }

    /** Commit history for a single file (follows renames). */
    async fileHistory(repoPath, filePath, maxCount = 200) {
        const args = [
            'log', '--follow', `--max-count=${maxCount}`,
            `--pretty=format:%H${US}%an${US}%ae${US}%at${US}%s`,
            '--', filePath,
        ];
        try {
            const { stdout } = await this.execGit(repoPath, args);
            if (!stdout.trim()) return [];
            return stdout.split('\n').filter(Boolean).map((line) => {
                const [id, author, email, ts, summary] = line.split(US);
                return { id, author, email, timestamp: parseInt(ts, 10) || 0, summary: summary || '' };
            });
        } catch (e) {
            return [];
        }
    }
}

module.exports = FileActions;

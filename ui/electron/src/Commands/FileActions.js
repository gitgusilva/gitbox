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

    /** Stash just one file (keeps the rest of the working tree intact). */
    async stashFile(repoPath, filePath, message = '') {
        const args = ['stash', 'push'];
        if (message) args.push('-m', message);
        args.push('--', filePath);
        await this.execGit(repoPath, args);
        return true;
    }

    /**
     * Export a file's diff as a `.patch` via a native save dialog.
     * @param {boolean} staged diff the staged version instead of the working tree
     * @returns {{ saved: boolean, path?: string }}
     */
    async savePatch(repoPath, filePath, staged = false) {
        const args = ['diff'];
        if (staged) args.push('--cached');
        args.push('--', filePath);
        const { stdout } = await this.execGit(repoPath, args);

        const defaultName = `${path.basename(filePath)}.patch`;
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

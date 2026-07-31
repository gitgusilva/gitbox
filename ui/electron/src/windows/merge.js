const { createChildWindow } = require('./child');

// Track open merge windows per repo so they can be auto-closed once that repo
// has no remaining conflicts (e.g. after the merge is completed/committed).
const openMergeWindows = [];

/** Close any open merge windows belonging to a repo (no more conflicts). */
function closeMergeWindowsForRepo(repoPath) {
    if (!repoPath) return;
    for (const entry of [...openMergeWindows]) {
        if (entry.repoPath === repoPath && entry.win && !entry.win.isDestroyed()) {
            entry.win.close();
        }
    }
}

/** Close every open merge window (e.g. the main window is closing). */
function closeAllMergeWindows() {
    for (const entry of [...openMergeWindows]) {
        if (entry.win && !entry.win.isDestroyed()) entry.win.destroy();
    }
    openMergeWindows.length = 0;
}

/**
 * Creates a standalone, resizable window dedicated to resolving merge
 * conflicts for a single file, in the renderer's "merge" mode.
 *
 * @param {{ repoPath: string, filePath: string }} target
 * @returns {BrowserWindow}
 */
function createMergeWindow({ repoPath, filePath }) {
    // Already resolving this file? Raise that window instead of opening a
    // second one on the same conflict.
    const existing = openMergeWindows.find(
        (e) => e.repoPath === repoPath && e.filePath === filePath && e.win && !e.win.isDestroyed(),
    );
    if (existing) {
        if (existing.win.isMinimized()) existing.win.restore();
        existing.win.focus();
        return existing.win;
    }

    const win = createChildWindow({
        mode: 'merge',
        query: { repo: repoPath, file: filePath },
        title: 'GitBox — Merge Editor',
    });

    openMergeWindows.push({ win, repoPath, filePath });
    win.on('closed', () => {
        const i = openMergeWindows.findIndex((e) => e.win === win);
        if (i >= 0) openMergeWindows.splice(i, 1);
    });

    return win;
}

module.exports = { createMergeWindow, closeMergeWindowsForRepo, closeAllMergeWindows };

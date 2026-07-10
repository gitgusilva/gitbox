const { BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const { DIST_INDEX, isDev, ICON } = require('../paths');

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
 * conflicts for a single file. It loads the same renderer bundle as the main
 * window, but in "merge" mode (see app/ui/src/main.ts) so only the merge
 * editor is mounted.
 *
 * @param {{ repoPath: string, filePath: string }} target
 * @returns {BrowserWindow}
 */
function createMergeWindow({ repoPath, filePath }) {
    const icon = nativeImage.createFromPath(ICON);

    const win = new BrowserWindow({
        width: 1100,
        height: 760,
        minWidth: 720,
        minHeight: 480,
        show: false,
        title: 'GitBox — Merge',
        titleBarStyle: 'hidden',
        icon,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });

    // DevTools shortcut, dev-only (see main window).
    if (isDev) {
        win.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                win.webContents.toggleDevTools();
                event.preventDefault();
            }
        });
    }

    const query = {
        mode: 'merge',
        repo: repoPath,
        file: filePath
    };

    if (isDev && process.env.NODE_ENV === 'development') {
        const search = new URLSearchParams(query).toString();
        win.loadURL(`http://localhost:1420/?${search}`);
    } else {
        win.loadFile(DIST_INDEX, { query });
    }

    win.once('ready-to-show', () => win.show());

    openMergeWindows.push({ win, repoPath });
    win.on('closed', () => {
        const i = openMergeWindows.findIndex((e) => e.win === win);
        if (i >= 0) openMergeWindows.splice(i, 1);
    });

    return win;
}

module.exports = { createMergeWindow, closeMergeWindowsForRepo, closeAllMergeWindows };

const { ipcMain, BrowserWindow } = require('electron');
const { createMergeWindow, closeMergeWindowsForRepo } = require('../windows/merge');

/**
 * Registers IPC for the standalone merge-conflict window.
 *
 * @param {() => BrowserWindow|null} getMainWindow - Accessor for the main window,
 *   used to refresh the repo view once a merge is resolved.
 */
module.exports = function (getMainWindow) {
    ipcMain.handle('gitbox:openMergeWindow', async (_event, repoPath, filePath) => {
        if (!repoPath || !filePath) return false;
        createMergeWindow({ repoPath, filePath });
        return true;
    });

    // Sent by the merge window after it saves + stages the resolved file.
    ipcMain.on('merge:resolved', (event) => {
        const main = getMainWindow && getMainWindow();
        if (main && !main.isDestroyed()) {
            main.webContents.send('merge:resolved-broadcast');
        }

        // Close the merge window that emitted the event.
        const sender = BrowserWindow.fromWebContents(event.sender);
        if (sender && !sender.isDestroyed()) sender.close();
    });

    // Main window signals a repo has no more conflicts (merge completed/committed)
    // → close any lingering merge windows for that repo.
    ipcMain.on('gitbox:closeMergeWindows', (_event, repoPath) => {
        closeMergeWindowsForRepo(repoPath);
    });
};

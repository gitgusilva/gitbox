const { ipcMain, BrowserWindow } = require('electron');

/**
 * Relays general-settings changes from whichever window made them (usually the
 * main window's Settings) to every OTHER open window — most importantly the
 * standalone merge-conflict windows, so e.g. changing the merge layout retints
 * / re-arranges them live instead of only on reopen.
 */
module.exports = function () {
    ipcMain.on('settings:broadcast', (event, settings) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) continue;
            if (win.webContents.id === event.sender.id) continue;
            win.webContents.send('settings:changed', settings);
        }
    });
};

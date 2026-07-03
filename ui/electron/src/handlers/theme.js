const { ipcMain, BrowserWindow } = require('electron');

/**
 * Relays theme changes from whichever window made them (usually the main
 * window's Appearance editor) to every OTHER open window — most importantly the
 * standalone merge-conflict windows, which otherwise keep the theme they had at
 * open time until reopened.
 */
module.exports = function () {
    ipcMain.on('theme:broadcast', (event, theme) => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed()) continue;
            if (win.webContents.id === event.sender.id) continue;
            win.webContents.send('theme:changed', theme);
        }
    });
};

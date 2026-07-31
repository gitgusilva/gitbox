const { ipcMain, BrowserWindow } = require('electron');

/**
 * Window chrome for the frameless windows.
 *
 * Every action targets the window that SENT it, not the focused one: with the
 * merge editor and the detached diff viewer open alongside the main window, a
 * click on one window's close button could land on another (the focused window
 * is not necessarily the sender — a click can arrive before focus settles, and
 * a renderer can act without being focused at all).
 */
function senderWindow(event) {
    return BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
}

module.exports = function () {
    ipcMain.on('window:minimize', (event) => {
        const win = senderWindow(event);
        if (win && !win.isDestroyed()) win.minimize();
    });
    ipcMain.on('window:maximize', (event) => {
        const win = senderWindow(event);
        if (win && !win.isDestroyed()) {
            if (win.isMaximized()) win.restore();
            else win.maximize();
        }
    });
    ipcMain.on('window:close', (event) => {
        const win = senderWindow(event);
        if (win && !win.isDestroyed()) win.close();
    });
    ipcMain.on('window:zoom', (event, factor) => {
        const win = senderWindow(event) || BrowserWindow.getAllWindows()[0];
        if (win && !win.isDestroyed()) win.webContents.setZoomFactor(factor);
    });
};

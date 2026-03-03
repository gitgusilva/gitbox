const { ipcMain, BrowserWindow } = require('electron');

module.exports = function () {
    ipcMain.on('window:minimize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.minimize();
    });
    ipcMain.on('window:maximize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            if (win.isMaximized()) win.restore();
            else win.maximize();
        }
    });
    ipcMain.on('window:close', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.close();
    });
    ipcMain.on('window:zoom', (_, factor) => {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.setZoomFactor(factor);
    });
};

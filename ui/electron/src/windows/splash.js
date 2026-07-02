const { BrowserWindow } = require('electron');
const { SPLASH_HTML } = require('../paths');

function createSplashWindow(icon) {
    const splashWindow = new BrowserWindow({
        width: 500,
        height: 350,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        icon: icon,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    splashWindow.loadFile(SPLASH_HTML);
    return splashWindow;
}

module.exports = { createSplashWindow };

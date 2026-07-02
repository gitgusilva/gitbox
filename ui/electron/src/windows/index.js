const { nativeImage } = require('electron');
const { createMainWindow } = require('./main');
const { createSplashWindow } = require('./splash');
const { SPLASH_HTML, ICON } = require('../paths');

let mainWindow = null;
let splashWindow = null;

function createWindow(isDev) {
    const icon = nativeImage.createFromPath(ICON);

    splashWindow = createSplashWindow(icon);

    mainWindow = createMainWindow(icon, isDev);

    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
        mainWindow.show();
    });
}

function getMainWindow() {
    return mainWindow;
}

module.exports = { createWindow, getMainWindow };

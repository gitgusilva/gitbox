const { BrowserWindow } = require('electron');
const { DIST_INDEX, isDev } = require('../paths');
const path = require('path'); // Added back for joining preload script if needed but it's cleaner in paths.js
const { closeAllMergeWindows } = require('./merge');

function createMainWindow(icon) {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1000,
        minHeight: 600,
        show: false,
        titleBarStyle: 'hidden',
        icon: icon,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });

    // Closing the main window tears down every standalone merge window too, so no
    // orphaned merge tools keep the app alive or linger on screen.
    mainWindow.on('close', () => closeAllMergeWindows());

    // Log why the renderer dies (crash / OOM) instead of failing silently.
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('[Renderer GONE]', JSON.stringify(details));
    });
    mainWindow.webContents.on('unresponsive', () => {
        console.error('[Renderer UNRESPONSIVE]');
    });
    // Forward renderer console to the dev log (handles both old and new Electron signatures).
    mainWindow.webContents.on('console-message', (a, b, c) => {
        const message = (a && typeof a === 'object' && 'message' in a) ? a.message : c;
        if (typeof message === 'string' && (message.includes('[PERF]') || message.toLowerCase().includes('error'))) {
            console.error('[Renderer]', message);
        }
    });

    // DevTools shortcut, dev-only. In production it would only help an attacker
    // inspect/pivot after a compromise, so it's gated off.
    if (isDev) {
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'i') {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }
        });
    }

    if (isDev && process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:1420');
    } else {
        mainWindow.loadFile(DIST_INDEX);
    }

    return mainWindow;
}

module.exports = { createMainWindow };

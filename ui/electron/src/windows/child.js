const { BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const { DIST_INDEX, isDev, ICON } = require('../paths');

/**
 * Creates a standalone window that loads the same renderer bundle as the main
 * window, in one of its alternate modes (see app/ui/src/main.ts). The merge
 * editor and the detached diff viewer are both built on this — window chrome,
 * the preload bridge, the dev-only DevTools shortcut and the dev/production
 * URL split are identical for every one of them, and theme changes reach them
 * all through the same `theme:broadcast` relay.
 *
 * @param {{ mode: string, query?: Record<string,string>, title?: string,
 *           width?: number, height?: number, minWidth?: number, minHeight?: number }} options
 * @returns {BrowserWindow}
 */
function createChildWindow({ mode, query = {}, title, width = 1100, height = 760, minWidth = 720, minHeight = 480 }) {
    const icon = nativeImage.createFromPath(ICON);

    const win = new BrowserWindow({
        width,
        height,
        minWidth,
        minHeight,
        show: false,
        title: title || 'GitBox',
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

    const params = { mode, ...query };

    if (isDev && process.env.NODE_ENV === 'development') {
        win.loadURL(`http://localhost:1420/?${new URLSearchParams(params).toString()}`);
    } else {
        win.loadFile(DIST_INDEX, { query: params });
    }

    win.once('ready-to-show', () => {
        win.show();
        // show() does not always raise the window on Linux; without this the
        // window can open behind the one that asked for it, and the click that
        // opened it looks like it did nothing.
        win.focus();
    });

    return win;
}

module.exports = { createChildWindow };

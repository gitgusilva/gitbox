const { BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { SPLASH_HTML } = require('../paths');

/** Read the theme snapshot the renderer persisted, so the splash can match it. */
function readSplashTheme() {
    try {
        const store = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'gitbox_config.json'), 'utf-8'));
        const raw = store['gitbox_splash_theme'];
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

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

    // Paint the splash with the active theme's colors (falls back to the CSS
    // defaults when there is no snapshot yet).
    const c = readSplashTheme();
    if (c) {
        splashWindow.webContents.on('did-finish-load', () => {
            const vars = [
                c.bg && `--sp-bg:${c.bg}`,
                c.surface && `--sp-surface:${c.surface}`,
                c.border && `--sp-border:${c.border}`,
                c.text && `--sp-text:${c.text}`,
                c.accent && `--sp-accent:${c.accent}`,
            ].filter(Boolean).join(';');
            if (vars) splashWindow.webContents.insertCSS(`:root{${vars}}`);
        });
    }

    return splashWindow;
}

module.exports = { createSplashWindow };

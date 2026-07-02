const path = require('path');
const { app } = require('electron');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Root of the electron package: ui/electron
const ELECTRON_ROOT = path.resolve(__dirname, '..');

// Assets folder
const ASSETS_PATH = path.resolve(ELECTRON_ROOT, 'assets');

// Root for system handlers (CHANGELOG.md, etc)
const PROJECT_ROOT = isDev
    ? path.resolve(ELECTRON_ROOT, '..', '..') // ui/electron/../.. -> gitbox/
    : ELECTRON_ROOT;                          // packaged root

module.exports = {
    isDev,
    PROJECT_ROOT,
    SPLASH_HTML: path.join(ASSETS_PATH, 'splash.html'),
    ICON: path.join(ASSETS_PATH, 'icon.png'),
    DIST_INDEX: isDev
        ? path.join(PROJECT_ROOT, 'dist', 'index.html')
        : path.join(ELECTRON_ROOT, 'dist', 'index.html')
};

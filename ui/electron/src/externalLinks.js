const { shell } = require('electron');
const { logger } = require('./logger');

const DEV_ORIGINS = ['http://localhost:1420', 'http://127.0.0.1:1420'];
const EXTERNAL_PROTOCOLS = ['https:', 'http:', 'mailto:'];

/**
 * Anything the app itself serves: the packaged bundle (file://), the Vite dev
 * server, and Chromium's own internal pages.
 */
function isInternal(url) {
    try {
        const u = new URL(String(url));
        if (u.protocol === 'file:' || u.protocol === 'devtools:' || u.protocol === 'about:') return true;
        return DEV_ORIGINS.includes(u.origin);
    } catch {
        return false;
    }
}

/** Hand a link to the user's default browser, ignoring schemes we don't trust. */
function openInBrowser(url) {
    try {
        const u = new URL(String(url));
        if (!EXTERNAL_PROTOCOLS.includes(u.protocol)) return false;
        shell.openExternal(u.toString());
        return true;
    } catch {
        return false;
    }
}

/**
 * Keeps every window pinned to the app. Links in release notes, PR bodies,
 * commit messages and toasts are markdown/HTML we don't control, so without this
 * a plain `<a href>` would navigate the renderer away from GitBox (or open a
 * bare Electron window for `target="_blank"`) instead of using the user's
 * browser. Registered app-wide so new windows are covered automatically.
 */
function installExternalLinkGuards(app) {
    app.on('web-contents-created', (_event, contents) => {
        contents.setWindowOpenHandler(({ url }) => {
            openInBrowser(url);
            return { action: 'deny' };
        });

        contents.on('will-navigate', (event, url) => {
            if (isInternal(url)) return;
            event.preventDefault();
            if (!openInBrowser(url)) {
                logger.warn(`[Links] blocked navigation to unsupported URL: ${url}`);
            }
        });
    });
}

module.exports = { installExternalLinkGuards, openInBrowser, isInternal };

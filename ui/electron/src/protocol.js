const { app } = require('electron');
const path = require('path');

/** Only forward well-formed gitbox:// deep links to the renderer — never an
 *  arbitrary string an attacker could pass on the command line / via open-url. */
function forwardDeepLink(getMainWindow, rawUrl) {
    const mainWindow = getMainWindow();
    if (!mainWindow || typeof rawUrl !== 'string' || rawUrl.length > 2048) return;
    try {
        const u = new URL(rawUrl);
        if (u.protocol !== 'gitbox:') return;
        mainWindow.webContents.send('protocol:url', u.toString());
    } catch {
        /* malformed URL — ignore */
    }
}

function setupProtocol(getMainWindow) {
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('gitbox', process.execPath, [path.resolve(process.argv[1])])
        }
    } else {
        app.setAsDefaultProtocolClient('gitbox')
    }

    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit()
        return false;
    } else {
        app.on('second-instance', (event, commandLine) => {
            const mainWindow = getMainWindow();
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore()
                mainWindow.focus()

                const url = commandLine.find(arg => arg.startsWith('gitbox://'));
                if (url) {
                    forwardDeepLink(getMainWindow, url);
                }
            }
        })
    }

    app.on('open-url', (event, url) => {
        event.preventDefault()
        forwardDeepLink(getMainWindow, url);
    })

    return true;
}

module.exports = { setupProtocol };

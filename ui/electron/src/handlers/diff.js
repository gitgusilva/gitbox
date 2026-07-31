const { ipcMain, BrowserWindow } = require('electron');
const { createDiffWindow, getDiffWindow, focusDiffWindow, closeDiffWindow } = require('../windows/diff');

/**
 * IPC for the detached diff viewer.
 *
 * The detached window renders whatever it is handed and owns no state: the
 * window that detached it keeps the file list, fetches contents and pushes
 * them over; the detached side sends back what the user asked for (next file,
 * re-attach). Everything travels through one relay channel, with the main
 * process deciding the direction from the sender.
 *
 * @param {() => BrowserWindow|null} getMainWindow
 */
module.exports = function (getMainWindow) {
    ipcMain.handle('gitbox:openDiffWindow', async () => {
        const win = createDiffWindow();

        // Closing the window from its own title bar counts as re-attaching:
        // tell the main window so the docked panel comes back instead of the
        // view being left thinking it is still detached.
        win.once('closed', () => {
            const main = getMainWindow && getMainWindow();
            if (main && !main.isDestroyed()) {
                main.webContents.send('diffwin:message', { type: 'closed' });
            }
        });

        return true;
    });

    ipcMain.handle('gitbox:closeDiffWindow', async () => {
        closeDiffWindow();
        return true;
    });

    ipcMain.on('diffwin:relay', (event, message) => {
        const diff = getDiffWindow();
        const isFromDiffWindow = diff && diff.webContents.id === event.sender.id;

        // Opening a file from the main window has to raise the detached
        // viewer, otherwise the click updates a window the user cannot see.
        if (!isFromDiffWindow && message?.type === 'focus') {
            focusDiffWindow();
            return;
        }

        const target = isFromDiffWindow ? (getMainWindow && getMainWindow()) : diff;
        if (target && !target.isDestroyed()) {
            target.webContents.send('diffwin:message', message);
        }
    });
};

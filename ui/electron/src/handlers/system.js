const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function (isDev, rootPath) {
    ipcMain.handle('gitbox:selectFolder', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('gitbox:openExternal', async (_, url) => shell.openExternal(url));

    ipcMain.handle('gitbox:getAppChangelog', async () => {
        const changelogPath = path.join(rootPath, 'CHANGELOG.md');
        try {
            return fs.readFileSync(changelogPath, 'utf-8');
        } catch (e) {
            console.error('Error reading changelog:', e);
            return '';
        }
    });
};

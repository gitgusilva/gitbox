const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function (addon) {
    ipcMain.handle('gitbox:listFiles', async (_, repoPath) => addon.listFiles(repoPath));
    ipcMain.handle('gitbox:getFileContent', async (_, repoPath, filePath) => addon.getFileContent(repoPath, filePath));

    ipcMain.handle('gitbox:saveFile', async (_, repoPath, filePath, content) => {
        const fullPath = path.join(repoPath, filePath);
        fs.writeFileSync(fullPath, content, 'utf8');
        return true;
    });
};

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function (addon) {
    ipcMain.handle('gitbox:listFiles', async (_, repoPath) => addon.listFiles(repoPath));
    ipcMain.handle('gitbox:getFileContent', async (_, repoPath, filePath) => addon.getFileContent(repoPath, filePath));

    ipcMain.handle('gitbox:saveFile', async (_, repoPath, filePath, content) => {
        const root = path.resolve(repoPath);
        const fullPath = path.resolve(root, filePath);
        // Contain writes to the repository — reject traversal (../) that would
        // escape it, so the renderer can't overwrite arbitrary files on disk.
        if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
            throw new Error('Refusing to write outside the repository');
        }
        fs.writeFileSync(fullPath, content, 'utf8');
        return true;
    });
};

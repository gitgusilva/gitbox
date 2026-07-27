const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Answers "is this path still a repository we can open?" without touching
 * libgit2 — the renderer needs to tell a repo that was MOVED/DELETED (close the
 * tab) apart from a folder that simply isn't a repo (say so, keep the tab).
 *
 * The check mirrors `git_repository_open`, which does NOT search parent
 * directories: a working tree has `.git` (a directory, or a file for worktrees
 * and submodules), a bare repo has HEAD/objects/refs at the top.
 */
function probeRepo(repoPath) {
    if (!repoPath) return { exists: false, isRepo: false };

    try {
        if (!fs.statSync(repoPath).isDirectory()) return { exists: false, isRepo: false };
    } catch {
        return { exists: false, isRepo: false };
    }

    if (fs.existsSync(path.join(repoPath, '.git'))) return { exists: true, isRepo: true };

    const bare = ['HEAD', 'objects', 'refs'].every(entry => fs.existsSync(path.join(repoPath, entry)));
    return { exists: true, isRepo: bare };
}

module.exports = function (addon) {
    ipcMain.handle('gitbox:probeRepo', async (_, repoPath) => probeRepo(repoPath));
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

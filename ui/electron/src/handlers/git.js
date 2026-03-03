const { ipcMain } = require('electron');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const isImage = (f) => /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(f);

module.exports = function (addon) {
    ipcMain.handle('gitbox:status', async (_, repoPath) => addon.status(repoPath));
    ipcMain.handle('gitbox:branches', async (_, repoPath) => addon.branches(repoPath));
    ipcMain.handle('gitbox:remotes', async (_, repoPath) => addon.remotes(repoPath));
    ipcMain.handle('gitbox:getSubmodules', async (_, repoPath) => {
        try {
            const { stdout } = await execAsync('git submodule status', { cwd: repoPath, maxBuffer: 1024 * 1024 });
            const lines = stdout.split('\n').filter(l => l.trim().length > 0);
            return lines.map(line => {
                const parts = line.trim().split(' ');
                return {
                    sha: parts[0].replace(/^[+-]/, ''),
                    path: parts[1],
                    ref: parts[2] ? parts[2].replace(/[()]/g, '') : '',
                    status: line.startsWith('-') ? 'uninitialized' : (line.startsWith('+') ? 'modified' : 'clean')
                };
            });
        } catch (e) {
            return [];
        }
    });
    ipcMain.handle('gitbox:tags', async (_, repoPath) => addon.tags(repoPath));
    ipcMain.handle('gitbox:stashes', async (_, repoPath) => addon.stashes(repoPath));
    ipcMain.handle('gitbox:log', async (_, repoPath, maxCount, refName) => addon.log(repoPath, maxCount, refName));
    ipcMain.handle('gitbox:stageAll', async (_, repoPath) => addon.stageAll(repoPath));
    ipcMain.handle('gitbox:unstageAll', async (_, repoPath) => addon.unstageAll(repoPath));
    ipcMain.handle('gitbox:discardAll', async (_, repoPath) => addon.discardAll(repoPath));
    ipcMain.handle('gitbox:commitAll', async (_, repoPath, message) => addon.commitAll(repoPath, message));
    ipcMain.handle('gitbox:checkoutBranch', async (_, repoPath, branchName) => addon.checkoutBranch(repoPath, branchName));

    ipcMain.handle('gitbox:diffFile', async (_, repoPath, filePath) => {
        if (isImage(filePath)) {
            const fs = require('fs');
            const path = require('path');
            const fullPath = path.join(repoPath, filePath);
            let original = '';

            try {
                const { stdout } = await execAsync(`git show HEAD:"${filePath}"`, { cwd: repoPath, encoding: 'buffer', maxBuffer: 1024 * 1024 * 15 });
                original = stdout.toString('base64');
            } catch (e) { }

            let modified = '';

            try {
                if (fs.existsSync(fullPath)) {
                    modified = fs.readFileSync(fullPath).toString('base64');
                }
            } catch (e) { }

            return { original, modified };
        }

        return addon.diffFile(repoPath, filePath);
    });

    ipcMain.handle('gitbox:diffStashFile', async (_, repoPath, stashId, filePath) => {
        const _isImg = isImage(filePath);
        const opts = { cwd: repoPath, maxBuffer: 1024 * 1024 * 15 };
        if (_isImg) opts.encoding = 'buffer';

        let original = '';
        try {
            const { stdout } = await execAsync(`git show ${stashId}^:"${filePath}"`, opts);
            original = _isImg ? stdout.toString('base64') : stdout;
        } catch (e) { }

        let modified = '';
        try {
            const { stdout } = await execAsync(`git show ${stashId}:"${filePath}"`, opts);
            modified = _isImg ? stdout.toString('base64') : stdout;
        } catch (e) {
            try {
                // Untracked inclusions in a stash might belong to the 3rd parent tree
                const { stdout } = await execAsync(`git show ${stashId}^3:"${filePath}"`, opts);
                modified = _isImg ? stdout.toString('base64') : stdout;
            } catch (err2) { }
        }

        return { path: filePath, original, modified };
    });

    ipcMain.handle('gitbox:commitFiles', async (_, repoPath, commitId) => addon.commitFiles(repoPath, commitId));
    ipcMain.handle('gitbox:getConfig', async (_, repoPath) => addon.getConfig(repoPath));
    ipcMain.handle('gitbox:setConfig', async (_, repoPath, name, email) => addon.setConfig(repoPath, name, email));

    ipcMain.handle('gitbox:stageFile', async (_, repoPath, filePath) => {
        try { await execAsync(`git add "${filePath}"`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:unstageFile', async (_, repoPath, filePath) => {
        try { await execAsync(`git reset HEAD "${filePath}"`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:discardFile', async (_, repoPath, filePath) => {
        try {
            try {
                await execAsync(`git checkout -- "${filePath}"`, { cwd: repoPath });
            } catch (e) {
                if (e.message.includes('is unmerged')) {
                    await execAsync(`git checkout HEAD -- "${filePath}"`, { cwd: repoPath });
                } else {
                    throw e;
                }
            }
            return true;
        } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:fetch', async (_, repoPath, remoteName) => {
        try { await execAsync(`git fetch ${remoteName || ''}`, { cwd: repoPath, timeout: 60000 }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:pull', async (_, repoPath, remoteName) => {
        try { await execAsync(`git pull ${remoteName || ''}`, { cwd: repoPath, timeout: 60000 }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:push', async (_, repoPath, remoteName) => {
        try { await execAsync(`git push ${remoteName || ''}`, { cwd: repoPath, timeout: 60000 }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:createBranch', async (_, repoPath, branchName) => {
        try { await execAsync(`git checkout -b "${branchName}"`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:deleteBranch', async (_, repoPath, branchName) => {
        try { await execAsync(`git branch -D "${branchName}"`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:stashSave', async (_, repoPath, message) => {
        try { await execAsync(`git stash save "${message || ''}"`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:stashChanges', async (_, repoPath, stashId) => addon.stashChanges(repoPath, stashId));

    ipcMain.handle('gitbox:stashPop', async (_, repoPath, stashId) => {
        try { await execAsync(`git stash pop ${stashId || ''}`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:stashDrop', async (_, repoPath, stashId) => {
        try { await execAsync(`git stash drop ${stashId || ''}`, { cwd: repoPath }); return true; } catch (e) { throw new Error(e.message); }
    });

    ipcMain.handle('gitbox:getStagedDiff', async (_, repoPath) => {
        try {
            const { stdout } = await execAsync('git diff --staged', { cwd: repoPath, maxBuffer: 1024 * 1024 * 5 });
            return stdout;
        } catch (e) { return ''; }
    });

    ipcMain.handle('gitbox:getFileDiff', async (_, repoPath, filePath) => {
        try {
            const { stdout } = await execAsync(`git diff "${filePath}"`, { cwd: repoPath, maxBuffer: 1024 * 1024 * 5 });
            return stdout;
        } catch (e) { return ''; }
    });

    ipcMain.handle('gitbox:getRemoteUrl', async (_, repoPath, remoteName) => {
        try {
            const { stdout } = await execAsync(`git remote get-url ${remoteName || 'origin'}`, { cwd: repoPath });
            return stdout.trim();
        } catch (e) { return ''; }
    });

    ipcMain.handle('gitbox:checkMerge', async (_, repoPath, toBranch, fromBranch) => {
        try {
            const checkBranch = (b) => b.includes('/') ? b : b;
            const b1 = checkBranch(toBranch);
            const b2 = checkBranch(fromBranch);

            const { stdout: baseOut } = await execAsync(`git merge-base ${b1} ${b2}`, { cwd: repoPath });
            const base = baseOut.trim();

            try {
                const { stdout, stderr } = await execAsync(`git merge-tree --name-only --write-tree ${b1} ${b2}`, { cwd: repoPath });
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                    const files = lines.slice(1).filter(l => l.trim() !== '');
                    return { hasConflicts: true, files };
                }
                return { hasConflicts: false, files: [] };
            } catch (err) {
                const lines = (err.stdout || '').trim().split('\n');
                if (lines.length > 1) {
                    const files = lines.slice(1).filter(l => l.trim() !== '');
                    return { hasConflicts: true, files };
                }
                return { hasConflicts: true, files: [] };
            }
        } catch (e) {
            return { hasConflicts: false, files: [] };
        }
    });

    ipcMain.handle('gitbox:diffCommitFile', async (_, repoPath, commitId, filePath) => {
        try {
            const _isImg = isImage(filePath);
            const opts = { cwd: repoPath, maxBuffer: 1024 * 1024 * 15, timeout: 15000 };
            if (_isImg) opts.encoding = 'buffer';

            let original = '';
            try {
                const { stdout } = await execAsync(`git show ${commitId}^:"${filePath}"`, opts);
                original = _isImg ? stdout.toString('base64') : stdout;
            } catch (e) { }

            let modified = '';
            try {
                const { stdout } = await execAsync(`git show ${commitId}:"${filePath}"`, opts);
                modified = _isImg ? stdout.toString('base64') : stdout;
            } catch (e) { }

            return { path: filePath, original, modified };
        } catch (e) { return { path: filePath, original: '', modified: '' }; }
    });
};

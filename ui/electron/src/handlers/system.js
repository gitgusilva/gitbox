const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

function checkTool(cmd) {
    try {
        const finder = process.platform === 'win32' ? 'where' : 'which';
        execFileSync(finder, [cmd], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

module.exports = function (isDev, rootPath) {
    ipcMain.handle('gitbox:selectFolder', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('gitbox:openExternal', async (_, url) => {
        // Only open web/mail links — never file://, smb://, custom schemes, etc.,
        // which shell.openExternal would otherwise happily launch.
        try {
            const u = new URL(String(url));
            if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
                await shell.openExternal(u.toString());
                return true;
            }
        } catch { /* invalid URL */ }
        return false;
    });

    ipcMain.handle('gitbox:getAppVersion', async () => app.getVersion());

    // Synchronous debug marker — writes straight to disk (appendFileSync flushes
    // immediately) so a mark survives even a native crash right after it.
    ipcMain.on('debug:mark', (event, label) => {
        try { fs.appendFileSync('/tmp/gitbox-marks.log', label + ' ' + Date.now() + '\n'); } catch (e) {}
        event.returnValue = 1;
    });

    ipcMain.handle('gitbox:getAppChangelog', async () => {
        const changelogPath = path.join(rootPath, 'CHANGELOG.md');
        try {
            return fs.readFileSync(changelogPath, 'utf-8');
        } catch (e) {
            console.error('Error reading changelog:', e);
            return '';
        }
    });

    ipcMain.handle('gitbox:detectExternalTools', async () => {
        const defaultEditors = [
            { id: 'code', cmd: 'code', label: 'Visual Studio Code' },
            { id: 'windsurf', cmd: 'windsurf', label: 'Windsurf' },
            { id: 'cursor', cmd: 'cursor', label: 'Cursor' },
            { id: 'zed', cmd: 'zed', label: 'Zed' },
            { id: 'antigravity', cmd: 'antigravity', label: 'Antigravity' }
        ];

        const defaultTerminals = [
            { id: 'gnome-terminal', cmd: 'gnome-terminal', label: 'GNOME Terminal' },
            { id: 'ghostty', cmd: 'ghostty', label: 'Ghostty' },
            { id: 'konsole', cmd: 'konsole', label: 'Konsole' },
            { id: 'kitty', cmd: 'kitty', label: 'Kitty' },
            { id: 'alacritty', cmd: 'alacritty', label: 'Alacritty' },
            { id: 'wezterm', cmd: 'wezterm', label: 'WezTerm' },
            { id: 'x-terminal-emulator', cmd: 'x-terminal-emulator', label: 'System Default' },
            { id: 'gitbox', cmd: 'echo', label: 'GitBox Integrated Terminal' }
        ];

        const defaultMerge = [
            { id: 'meld', cmd: 'meld', label: 'Meld' },
            { id: 'kdiff3', cmd: 'kdiff3', label: 'KDiff3' },
            { id: 'p4merge', cmd: 'p4merge', label: 'P4Merge' }
        ];

        const detect = (list) => list.filter(t => t.id === 'gitbox' || checkTool(t.cmd)).map(t => ({ value: t.id, label: t.label }));

        return {
            editors: detect(defaultEditors),
            terminals: detect(defaultTerminals),
            mergeTools: detect(defaultMerge)
        };
    });

};

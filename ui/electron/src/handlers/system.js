const { ipcMain, dialog, shell, app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

// GUI-launched apps (desktop entry / AppImage / rpm) inherit a minimal PATH — often
// just /usr/bin:/bin — so `which code` fails even when the tool is installed. Recover
// the user's real PATH from a login shell and add the usual install dirs (flatpak,
// snap, ~/.local/bin), then probe each dir directly instead of relying on `which`.
let _augmentedPath = null;
function augmentedPath() {
    if (_augmentedPath) return _augmentedPath;
    let p = process.env.PATH || '';
    if (process.platform !== 'win32') {
        try {
            const shellBin = process.env.SHELL || '/bin/bash';
            const out = execFileSync(shellBin, ['-lic', 'printf %s "$PATH"'], { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] });
            if (out && out.trim()) p = out.trim();
        } catch { /* fall back to process PATH */ }
    }
    const home = os.homedir();
    const extra = process.platform === 'win32' ? [] : [
        '/usr/local/bin', '/usr/bin', '/bin', '/snap/bin',
        '/var/lib/flatpak/exports/bin',
        path.join(home, '.local/bin'),
        path.join(home, '.local/share/flatpak/exports/bin'),
        '/opt/homebrew/bin'
    ];
    const parts = p.split(path.delimiter).filter(Boolean);
    for (const e of extra) if (!parts.includes(e)) parts.push(e);
    _augmentedPath = parts.join(path.delimiter);
    return _augmentedPath;
}

function checkTool(cmd) {
    if (!cmd) return false;
    // Absolute/relative path given directly.
    if (cmd.includes('/') || cmd.includes('\\')) {
        try { fs.accessSync(cmd, fs.constants.X_OK); return true; } catch { return false; }
    }
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
    for (const dir of augmentedPath().split(path.delimiter)) {
        if (!dir) continue;
        for (const ext of exts) {
            try {
                fs.accessSync(path.join(dir, cmd + ext), fs.constants.X_OK);
                return true;
            } catch { /* keep scanning */ }
        }
    }
    return false;
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
        // Industry-standard tools probed on PATH. Anything found is offered in the
        // Settings ▸ Git & Tools selects; the rest are simply omitted.
        // VS Code and its forks all speak the same `--wait --merge/--diff` protocol,
        // so they double as merge AND diff tools. Defined once, reused in all lists.
        // `flatpak` is the app id to also probe (Flatpak installs export the id, not
        // the short binary name, e.g. Meld → org.gnome.meld).
        const vscodeFamily = [
            { id: 'code', cmd: 'code', flatpak: 'com.visualstudio.code', label: 'Visual Studio Code' },
            { id: 'code-insiders', cmd: 'code-insiders', label: 'VS Code Insiders' },
            { id: 'vscodium', cmd: 'codium', flatpak: 'com.vscodium.codium', label: 'VSCodium' },
            { id: 'cursor', cmd: 'cursor', label: 'Cursor' },
            { id: 'windsurf', cmd: 'windsurf', label: 'Windsurf' },
            { id: 'antigravity', cmd: 'antigravity', label: 'Antigravity' },
        ];

        const defaultEditors = [
            ...vscodeFamily,
            { id: 'zed', cmd: 'zed', flatpak: 'dev.zed.Zed', label: 'Zed' },
            { id: 'subl', cmd: 'subl', label: 'Sublime Text' },
            { id: 'atom', cmd: 'atom', label: 'Atom' },
            { id: 'idea', cmd: 'idea', label: 'IntelliJ IDEA' },
            { id: 'pycharm', cmd: 'pycharm', label: 'PyCharm' },
            { id: 'webstorm', cmd: 'webstorm', label: 'WebStorm' },
            { id: 'phpstorm', cmd: 'phpstorm', label: 'PhpStorm' },
            { id: 'goland', cmd: 'goland', label: 'GoLand' },
            { id: 'nvim', cmd: 'nvim', label: 'Neovim' },
            { id: 'vim', cmd: 'vim', label: 'Vim' },
            { id: 'emacs', cmd: 'emacs', label: 'Emacs' },
            { id: 'micro', cmd: 'micro', label: 'micro' },
            { id: 'nano', cmd: 'nano', label: 'nano' },
            { id: 'gedit', cmd: 'gedit', label: 'gedit' },
            { id: 'kate', cmd: 'kate', label: 'Kate' },
            // Windows editors (ignored on Linux/macOS since the binaries aren't found).
            { id: 'notepad++', cmd: 'notepad++', label: 'Notepad++' }
        ];

        const defaultTerminals = [
            { id: 'gitbox', cmd: 'echo', label: 'GitBox Integrated Terminal' },
            { id: 'gnome-terminal', cmd: 'gnome-terminal', label: 'GNOME Terminal' },
            { id: 'ghostty', cmd: 'ghostty', label: 'Ghostty' },
            { id: 'konsole', cmd: 'konsole', label: 'Konsole' },
            { id: 'kitty', cmd: 'kitty', label: 'Kitty' },
            { id: 'alacritty', cmd: 'alacritty', label: 'Alacritty' },
            { id: 'wezterm', cmd: 'wezterm', label: 'WezTerm' },
            { id: 'tilix', cmd: 'tilix', label: 'Tilix' },
            { id: 'terminator', cmd: 'terminator', label: 'Terminator' },
            { id: 'foot', cmd: 'foot', label: 'foot' },
            { id: 'xterm', cmd: 'xterm', label: 'xterm' },
            { id: 'x-terminal-emulator', cmd: 'x-terminal-emulator', label: 'System Default' }
        ];

        const defaultMerge = [
            { id: 'meld', cmd: 'meld', flatpak: 'org.gnome.meld', label: 'Meld' },
            { id: 'kdiff3', cmd: 'kdiff3', flatpak: 'org.kde.kdiff3', label: 'KDiff3' },
            { id: 'p4merge', cmd: 'p4merge', label: 'P4Merge' },
            { id: 'bc', cmd: 'bcompare', label: 'Beyond Compare' },
            { id: 'diffmerge', cmd: 'diffmerge', label: 'DiffMerge' },
            { id: 'smerge', cmd: 'smerge', label: 'Sublime Merge' },
            ...vscodeFamily,
            { id: 'vimdiff', cmd: 'vimdiff', label: 'vimdiff' },
            { id: 'nvimdiff', cmd: 'nvim', label: 'Neovim (nvimdiff)' },
            // Windows merge tools (bcomp/winmergeu/tortoisemerge resolve only on Windows).
            { id: 'bc-win', cmd: 'bcomp', label: 'Beyond Compare' },
            { id: 'winmerge', cmd: 'winmergeu', label: 'WinMerge' },
            { id: 'tortoisemerge', cmd: 'tortoisemerge', label: 'TortoiseMerge' }
        ];

        // Diff tools overlap heavily with merge tools + a few diff-only extras.
        const defaultDiff = [
            { id: 'meld', cmd: 'meld', flatpak: 'org.gnome.meld', label: 'Meld' },
            { id: 'kdiff3', cmd: 'kdiff3', flatpak: 'org.kde.kdiff3', label: 'KDiff3' },
            { id: 'p4merge', cmd: 'p4merge', label: 'P4Merge' },
            { id: 'bc', cmd: 'bcompare', label: 'Beyond Compare' },
            { id: 'diffmerge', cmd: 'diffmerge', label: 'DiffMerge' },
            ...vscodeFamily,
            { id: 'delta', cmd: 'delta', label: 'delta' },
            { id: 'difft', cmd: 'difft', label: 'difftastic' },
            { id: 'vimdiff', cmd: 'vimdiff', label: 'vimdiff' },
            // Windows diff tools.
            { id: 'bc-win', cmd: 'bcomp', label: 'Beyond Compare' },
            { id: 'winmerge', cmd: 'winmergeu', label: 'WinMerge' }
        ];

        const detect = (list) => list
            .filter(t => t.id === 'gitbox' || checkTool(t.cmd) || (t.flatpak && checkTool(t.flatpak)))
            .map(t => ({ value: t.id, label: t.label }));

        return {
            editors: detect(defaultEditors),
            terminals: detect(defaultTerminals),
            mergeTools: detect(defaultMerge),
            diffTools: detect(defaultDiff)
        };
    });

};

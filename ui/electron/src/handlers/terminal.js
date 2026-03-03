const { ipcMain, BrowserWindow } = require('electron');
const os = require('os');
const fs = require('fs');

module.exports = function (pty) {
    const ptyProcesses = {};
    let ptyCounter = 1;

    ipcMain.handle('terminal:spawn', (_, repoPath) => {
        const id = ptyCounter++;
        console.log('[Terminal] Spawning process for:', repoPath);
        let shellInstance = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');

        // Safety check for linux paths
        if (os.platform() !== 'win32' && !fs.existsSync(shellInstance)) {
            shellInstance = fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
        }

        const ptyProcess = pty.spawn(shellInstance, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: repoPath,
            env: process.env
        });

        ptyProcesses[id] = ptyProcess;

        ptyProcess.onData((data) => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('terminal:data', id, data);
        });

        ptyProcess.onExit(() => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('terminal:exit', id);
            delete ptyProcesses[id];
        });

        return id;
    });

    ipcMain.on('terminal:write', (_, id, data) => {
        if (ptyProcesses[id]) ptyProcesses[id].write(data);
    });

    ipcMain.on('terminal:resize', (_, id, cols, rows) => {
        if (ptyProcesses[id]) ptyProcesses[id].resize(cols, rows);
    });

    ipcMain.on('terminal:kill', (_, id) => {
        if (ptyProcesses[id]) {
            ptyProcesses[id].kill();
            delete ptyProcesses[id];
        }
    });
};

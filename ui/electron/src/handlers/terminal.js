const { ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const host = require('../host');

module.exports = function (pty) {
    const ptyProcesses = {};
    let ptyCounter = 1;

    ipcMain.handle('terminal:spawn', (event, repoPath) => {
        const id = ptyCounter++;
        console.log('[Terminal] Spawning process for:', repoPath);
        let shellInstance = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');

        // Safety check for linux paths
        if (os.platform() !== 'win32' && !fs.existsSync(shellInstance)) {
            shellInstance = fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh';
        }

        // In a Flatpak the shell above is the runtime's, so the terminal would
        // open with none of the user's toolchains on PATH — the one thing people
        // reach for the terminal to use. Run their login shell on the host
        // instead; outside a Flatpak spawnArgs hands the command back untouched.
        if (host.usable()) shellInstance = host.loginShell();
        const [shellFile, shellArgs] = host.spawnArgs(shellInstance, [], {
            cwd: repoPath,
            // flatpak-spawn does not forward the environment, and a shell with no
            // TERM renders as a dumb terminal.
            env: { TERM: 'xterm-color' }
        });

        const ptyProcess = pty.spawn(shellFile, shellArgs, {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: repoPath,
            env: process.env
        });

        ptyProcesses[id] = ptyProcess;

        // Output goes back to the renderer that ASKED for this shell, not to
        // whatever window happens to be focused. Routing by focus lost output
        // whenever another window took over (the merge editor opens its own) or
        // the app was in the background — bytes delivered to a window that has no
        // xterm for that id are gone for good, which is why terminals came back
        // with holes in their scrollback after minimizing or switching around.
        const owner = event.sender;
        const send = (channel, ...args) => {
            if (!owner.isDestroyed()) owner.send(channel, ...args);
        };

        ptyProcess.onData((data) => send('terminal:data', id, data));

        ptyProcess.onExit(() => {
            send('terminal:exit', id);
            delete ptyProcesses[id];
        });

        // The window owning this shell went away (closed/reloaded): nothing can
        // read it anymore, so don't leave the process running forever.
        owner.once('destroyed', () => {
            if (ptyProcesses[id]) {
                try { ptyProcesses[id].kill(); } catch { /* already gone */ }
                delete ptyProcesses[id];
            }
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

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const addon = require(isDev ? '../../../core/addon' : '../core/addon');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const os = require('os');
const pty = require('node-pty');
const fs = require('fs');

const storePath = path.join(app.getPath('userData'), 'gitbox_config.json');

function getStore() {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf-8')); }
  catch (e) { return {}; }
}
function saveStore(data) {
  try { fs.writeFileSync(storePath, JSON.stringify(data, null, 2)); }
  catch (e) { }
}

const ptyProcesses = {};
let ptyCounter = 1;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:1420');
  } else {
    win.loadFile(path.join(__dirname, isDev ? '../../../dist/index.html' : '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('gitbox:status', async (_, repoPath) => addon.status(repoPath));
  ipcMain.handle('gitbox:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('gitbox:openExternal', async (_, url) => shell.openExternal(url));
  ipcMain.handle('terminal:spawn', (_, repoPath) => {
    const id = ptyCounter++;
    const shellInstance = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
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
  ipcMain.handle('gitbox:branches', async (_, repoPath) => addon.branches(repoPath));
  ipcMain.handle('gitbox:remotes', async (_, repoPath) => addon.remotes(repoPath));
  ipcMain.handle('gitbox:tags', async (_, repoPath) => addon.tags(repoPath));
  ipcMain.handle('gitbox:stashes', async (_, repoPath) => addon.stashes(repoPath));
  ipcMain.handle('gitbox:log', async (_, repoPath, maxCount, refName) => addon.log(repoPath, maxCount, refName));
  ipcMain.handle('gitbox:stageAll', async (_, repoPath) => addon.stageAll(repoPath));
  ipcMain.handle('gitbox:unstageAll', async (_, repoPath) => addon.unstageAll(repoPath));
  ipcMain.handle('gitbox:discardAll', async (_, repoPath) => addon.discardAll(repoPath));
  ipcMain.handle('gitbox:commitAll', async (_, repoPath, message) => addon.commitAll(repoPath, message));
  ipcMain.handle('gitbox:checkoutBranch', async (_, repoPath, branchName) => addon.checkoutBranch(repoPath, branchName));
  ipcMain.handle('gitbox:fetch', async (_, repoPath, remoteName) => {
    try { await execAsync(`git fetch ${remoteName || ''}`, { cwd: repoPath, timeout: 60000 }); return true; } catch (e) { throw new Error(e.message); }
  });
  ipcMain.handle('gitbox:pull', async (_, repoPath, remoteName) => {
    try { await execAsync(`git pull ${remoteName || ''}`, { cwd: repoPath, timeout: 60000 }); return true; } catch (e) { throw new Error(e.message); }
  });
  ipcMain.handle('gitbox:push', async (_, repoPath, remoteName) => {
    try { await execAsync(`git push ${remoteName || ''}`, { cwd: repoPath, timeout: 60000 }); return true; } catch (e) { throw new Error(e.message); }
  });
  ipcMain.handle('gitbox:diffFile', async (_, repoPath, filePath) => addon.diffFile(repoPath, filePath));
  ipcMain.handle('gitbox:stashChanges', async (_, repoPath, stashId) => addon.stashChanges(repoPath, stashId));
  ipcMain.handle('gitbox:diffStashFile', async (_, repoPath, stashId, filePath) => addon.diffStashFile(repoPath, stashId, filePath));
  ipcMain.handle('gitbox:commitFiles', async (_, repoPath, commitId) => {
    try {
      const { stdout } = await execAsync(`git diff-tree --no-commit-id --name-status -r ${commitId}`, { cwd: repoPath, timeout: 10000 });
      return stdout.split('\n').filter(Boolean).map(line => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          let statusStr = 'modified';
          if (parts[0].startsWith('A')) statusStr = 'added';
          if (parts[0].startsWith('D')) statusStr = 'deleted';
          if (parts[0].startsWith('R')) statusStr = 'renamed';
          return { path: parts[parts.length - 1], status: statusStr };
        }
        return null;
      }).filter(Boolean);
    } catch (e) { return []; }
  });
  ipcMain.handle('gitbox:diffCommitFile', async (_, repoPath, commitId, filePath) => {
    try {
      const { stdout: diffStr } = await execAsync(`git diff ${commitId}^! -- "${filePath}"`, { cwd: repoPath, timeout: 10000 });
      if (!diffStr) return { path: filePath, original: '', modified: '' };

      const opts = { cwd: repoPath, maxBuffer: 1024 * 1024 * 15, timeout: 15000 };
      let original = '';
      try { const { stdout } = await execAsync(`git show ${commitId}^:"${filePath}"`, opts); original = stdout; } catch (e) { }

      let modified = '';
      try { const { stdout } = await execAsync(`git show ${commitId}:"${filePath}"`, opts); modified = stdout; } catch (e) { }

      return { path: filePath, original, modified };
    } catch (e) { return { path: filePath, original: '', modified: '' }; }
  });
  ipcMain.handle('gitbox:getConfig', async (_, repoPath) => addon.getConfig(repoPath));
  ipcMain.handle('gitbox:setConfig', async (_, repoPath, name, email) => {
    try {
      if (name) await execAsync(`git config user.name "${name}"`, { cwd: repoPath });
      if (email) await execAsync(`git config user.email "${email}"`, { cwd: repoPath });
      return true;
    } catch (e) {
      return false;
    }
  });
  ipcMain.handle('gitbox:saveFile', async (_, repoPath, filePath, content) => {
    const fullPath = path.join(repoPath, filePath);
    require('fs').writeFileSync(fullPath, content, 'utf8');
    return true;
  });

  ipcMain.on('store:get', (event, key) => {
    event.returnValue = getStore()[key];
  });
  ipcMain.on('store:set', (event, key, value) => {
    const store = getStore();
    store[key] = value;
    saveStore(store);
    event.returnValue = true;
  });
  ipcMain.on('store:delete', (event, key) => {
    const store = getStore();
    delete store[key];
    saveStore(store);
    event.returnValue = true;
  });

  ipcMain.on('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });
  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) win.restore();
      else win.maximize();
    }
  });
  ipcMain.on('window:close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });

  ipcMain.on('window:zoom', (_, factor) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.setZoomFactor(factor);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

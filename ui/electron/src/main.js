const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron');
app.setName('GitBox');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const addon = require(isDev ? '../../../core/addon' : '../core/addon');
const os = require('os');
const fs = require('fs');

const registerStoreHandlers = require('./handlers/store');
const registerWindowHandlers = require('./handlers/window');
const registerTerminalHandlers = require('./handlers/terminal');
const registerSystemHandlers = require('./handlers/system');
const registerFSHandlers = require('./handlers/fs');
const registerGitHandlers = require('./handlers/git');

console.log('[Main] Initializing GitBox...');
let pty;
try {
  pty = require('node-pty');
  console.log('[Main] node-pty loaded successfully');
} catch (e) {
  console.error('[Main] Failed to load node-pty:', e);
}
const storePath = path.join(app.getPath('userData'), 'gitbox_config.json');

registerStoreHandlers(app, storePath);
registerWindowHandlers();

let mainWindow = null;
let splashWindow = null;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('gitbox', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('gitbox')
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()

      const url = commandLine.find(arg => arg.startsWith('gitbox://'));
      if (url) {
        mainWindow.webContents.send('protocol:url', url);
      }
    }
  })
}


function createWindow() {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  splashWindow.loadFile(path.join(__dirname, '../assets/splash.html'));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    titleBarStyle: 'hidden',
    icon: icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.show();
  });

  // Enable DevTools for debugging in production via shortcut
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:1420');
  } else {
    mainWindow.loadFile(path.join(__dirname, isDev ? '../../../dist/index.html' : '../dist/index.html'));
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  console.log('[Protocol] Received URL:', url);
  if (mainWindow) {
    mainWindow.webContents.send('protocol:url', url);
  }
})

app.whenReady().then(() => {
  const rootPath = isDev ? path.join(__dirname, '..', '..', '..') : path.join(__dirname, '..');

  registerSystemHandlers(isDev, rootPath);
  registerTerminalHandlers(pty);
  registerFSHandlers(addon);
  registerGitHandlers(addon);

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

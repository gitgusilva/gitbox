const { app, ipcMain, BrowserWindow } = require('electron');
const { logger } = require('./logger');

// Native auto-update, backed by electron-updater + the GitHub Release published
// by the CI tag builds (see .github/workflows/build-*.yml). Only the targets
// that ship an updater metadata file self-update — NSIS on Windows and the
// AppImage on Linux, both of which get a .blockmap so downloads are
// *differential* (only the changed chunks, not the whole installer). The
// OS-package targets (deb/rpm/pacman/msi) are updated by the system package
// manager, so for those we report `unsupported` and the renderer falls back to
// "open the releases page".

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (e) {
  logger.warn('[Updater] electron-updater unavailable:', e && e.message);
}

// Last known status, mirrored to any renderer that asks — so a Settings panel
// opened mid-download renders the live state without waiting for the next event.
let state = { state: 'idle', info: null, progress: null, error: null };

function broadcast() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('updater:status', state);
  }
}

function setState(next) {
  state = { state: 'idle', info: null, progress: null, error: null, ...next };
  broadcast();
}

// electron-updater can only self-update the NSIS (win) and AppImage (linux)
// artifacts. There's no app-update.yml in dev (unpackaged), the AppImage sets
// $APPIMAGE at runtime, and deb/rpm/pacman/msi have no differential updater.
function isSupported() {
  if (!autoUpdater || !app.isPackaged) return false;
  if (process.platform === 'linux') return !!process.env.APPIMAGE;
  return true; // win32 (NSIS), darwin (dmg/zip)
}

let wired = false;
function wire() {
  if (wired || !autoUpdater) return;
  wired = true;

  autoUpdater.autoDownload = true;          // silent background download on check
  autoUpdater.autoInstallOnAppQuit = true;  // apply on next quit if not restarted now
  autoUpdater.logger = {
    info: (m) => logger.info('[Updater]', m),
    warn: (m) => logger.warn('[Updater]', m),
    error: (m) => logger.error('[Updater]', m),
    debug: () => {},
  };

  autoUpdater.on('checking-for-update', () => setState({ state: 'checking' }));
  autoUpdater.on('update-available', (info) =>
    setState({ state: 'available', info: { version: info.version, releaseNotes: info.releaseNotes, releaseDate: info.releaseDate } }));
  autoUpdater.on('update-not-available', (info) =>
    setState({ state: 'not-available', info: { version: info && info.version } }));
  autoUpdater.on('download-progress', (p) =>
    setState({ state: 'downloading', info: state.info, progress: { percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond } }));
  autoUpdater.on('update-downloaded', (info) =>
    setState({ state: 'downloaded', info: { version: info.version, releaseNotes: info.releaseNotes } }));
  autoUpdater.on('error', (err) => {
    logger.error('[Updater] error:', err);
    setState({ state: 'error', error: String((err && err.message) || err) });
  });
}

function registerUpdater() {
  ipcMain.handle('updater:getState', () => ({ ...state, supported: isSupported() }));

  ipcMain.handle('updater:check', async () => {
    if (!isSupported()) return { supported: false };
    wire();
    try { await autoUpdater.checkForUpdates(); }
    catch (e) { setState({ state: 'error', error: String((e && e.message) || e) }); }
    return { supported: true };
  });

  ipcMain.handle('updater:download', async () => {
    if (!isSupported()) return { supported: false };
    wire();
    try { await autoUpdater.downloadUpdate(); }
    catch (e) { setState({ state: 'error', error: String((e && e.message) || e) }); }
    return { supported: true };
  });

  ipcMain.handle('updater:install', () => {
    if (!isSupported()) return { supported: false };
    // Defer so the IPC reply is sent before the app tears down. isSilent=false
    // shows the NSIS UI; isForceRunAfter=true relaunches GitBox afterwards.
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { supported: true };
  });
}

module.exports = { registerUpdater, isUpdaterSupported: isSupported };

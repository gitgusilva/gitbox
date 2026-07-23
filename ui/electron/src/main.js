const { app, ipcMain, shell, dialog, session } = require('electron');
const path = require('path');

// MUST run before anything resolves app.getPath('userData') — Electron caches
// that path on first access, so a later setName() is silently ignored. When this
// sat further down, the packaged build (logger resolves userData at require
// time) used <appData>/gitbox while dev (logger writes to the repo instead)
// used <appData>/GitBox: two separate stores, so an account connected in one
// build looked disconnected in the other and remote ops failed to authenticate.
app.setName('GitBox');

const addon = require('gitbox-addon');
const { isDev, PROJECT_ROOT } = require('./paths');
const { logger, instrumentIpc, installCrashHandlers } = require('./logger');
const { adoptLegacyStore } = require('./storeMigration');
const credentialStore = require('./credentialStore');

// Install as early as possible so nothing that can crash the app goes unlogged.
installCrashHandlers(app);
instrumentIpc(ipcMain);

const registerStoreHandlers = require('./handlers/store');
const registerWindowHandlers = require('./handlers/window');
const registerTerminalHandlers = require('./handlers/terminal');
const registerSystemHandlers = require('./handlers/system');
const registerFSHandlers = require('./handlers/fs');
const registerGitHandlers = require('./handlers/git');
const registerMergeHandlers = require('./handlers/merge');
const registerThemeHandlers = require('./handlers/theme');
const registerSettingsHandlers = require('./handlers/settings');
const registerAiHandlers = require('./handlers/ai');
const { registerUpdater } = require('./updater');

const { setupProtocol } = require('./protocol');
const { createWindow, getMainWindow } = require('./windows/index');

logger.info('[Main] Initializing GitBox...');
let pty;
try {
  pty = require('node-pty');
  logger.info('[Main] node-pty loaded successfully');
} catch (e) {
  logger.error('[Main] Failed to load node-pty:', e);
}

const storePath = path.join(app.getPath('userData'), 'gitbox_config.json');

// Settings written by builds that ran before the setName fix live under the old
// directory name. Bring them across once so nobody loses their integrations,
// repos and preferences on upgrade.
adoptLegacyStore(app, storePath);

// Access tokens out of the (world-readable) settings file and into the encrypted
// store. Must happen BEFORE registerStoreHandlers, which caches the file in
// memory — a later rewrite here would be clobbered by that cache on next write.
const movedCredentials = credentialStore.migrateFromSettings(storePath);
if (movedCredentials) {
  logger.info(`[Credentials] encrypted ${movedCredentials} saved credential(s) out of the settings file`);
}
credentialStore.protectSettingsFile(storePath);

registerStoreHandlers(app, storePath);
registerWindowHandlers();

// Setup protocol and instance lock
if (!setupProtocol(getMainWindow)) {
  // It's allowed but usually better to let the app quit via its lifecycle
  process.exit(0);
}

app.whenReady().then(() => {
  // Content-Security-Policy: block injected/inline scripts (the XSS→IPC→RCE
  // escalation path) while still allowing the app's real needs (Monaco workers,
  // inline styles, https API/image fetches). Applied in production only — a Vite
  // dev server needs 'unsafe-eval'/ws: for HMR, so we don't fight it in dev.
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            // ApexCharts (Statistics view) compiles helpers via new Function(),
            // which needs 'unsafe-eval'. Safe-ish here: 'unsafe-inline' is NOT
            // allowed, so injected inline <script> is still blocked — this only
            // re-enables eval for our own bundled, local code.
            "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob: https:; " +
            "font-src 'self' data:; " +
            "connect-src 'self' https:; " +
            "worker-src 'self' blob:; " +
            "child-src 'self' blob:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "frame-ancestors 'none'"
          ]
        }
      });
    });
  }

  registerSystemHandlers(isDev, PROJECT_ROOT);
  registerTerminalHandlers(pty);
  registerFSHandlers(addon);
  registerGitHandlers(addon);
  registerMergeHandlers(getMainWindow);
  registerThemeHandlers();
  registerSettingsHandlers();
  registerAiHandlers();
  registerUpdater();

  createWindow(isDev);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

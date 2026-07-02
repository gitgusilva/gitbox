const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { isDev, PROJECT_ROOT } = require('./paths');

// Where the log file lives:
//  - dev:  <repo>/logs/gitbox-main.log        (easy to find while developing)
//  - prod: <userData>/logs/gitbox-main.log    (writable when installed)
function resolveLogDir() {
  try {
    const base = isDev ? PROJECT_ROOT : app.getPath('userData');
    return path.join(base, 'logs');
  } catch (_) {
    // app paths may be unavailable extremely early; fall back to cwd
    return path.join(process.cwd(), 'logs');
  }
}

const LOG_DIR = resolveLogDir();
const LOG_FILE = path.join(LOG_DIR, 'gitbox-main.log');

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {
  /* ignore */
}

function stamp() {
  // Local ISO-ish timestamp with millis
  const d = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  );
}

function fmt(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
}

// Synchronous append: critical so the last line survives a native SIGSEGV
// (an async write would still be buffered when the process is killed).
function write(level, parts) {
  const line = `[${stamp()}] [${level}] ${parts.map(fmt).join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {
    /* nothing else we can do */
  }
  const sink = level === 'ERROR' ? console.error : console.log;
  sink(line.trimEnd());
}

const logger = {
  file: LOG_FILE,
  info: (...a) => write('INFO', a),
  warn: (...a) => write('WARN', a),
  error: (...a) => write('ERROR', a),
  debug: (...a) => write('DEBUG', a),
};

// Truncate large/sensitive args (diffs, file contents) so lines stay readable.
function briefArgs(args) {
  return args.map((a) => {
    if (typeof a === 'string') return a.length > 200 ? a.slice(0, 200) + `…(${a.length})` : a;
    if (a && typeof a === 'object') return '[object]';
    return a;
  });
}

/**
 * Monkey-patch ipcMain.handle so every IPC invocation is logged BEFORE it runs
 * (synchronously flushed) and again on completion/failure. If a handler calls
 * into the native addon and segfaults, the "-> call" line is the last thing in
 * the log, pinpointing exactly which operation and repo crashed the process.
 */
function instrumentIpc(ipcMain) {
  const originalHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, listener) => {
    return originalHandle(channel, async (event, ...args) => {
      const started = Date.now();
      logger.info(`IPC -> ${channel}`, briefArgs(args));
      try {
        const result = await listener(event, ...args);
        logger.info(`IPC <- ${channel} ok (${Date.now() - started}ms)`);
        return result;
      } catch (err) {
        logger.error(`IPC xx ${channel} failed (${Date.now() - started}ms):`, err);
        throw err;
      }
    });
  };
}

/**
 * Catch every failure mode that can take the app down and record it. A native
 * addon segfault surfaces here as a 'render-process-gone'/'child-process-gone'
 * with reason "crashed", right after the last "IPC ->" line.
 */
function installCrashHandlers(appRef) {
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException:', err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection:', reason);
  });
  process.on('exit', (code) => {
    logger.info(`process exit code=${code}`);
  });

  appRef.on('render-process-gone', (_event, _wc, details) => {
    logger.error('render-process-gone:', details);
  });
  appRef.on('child-process-gone', (_event, details) => {
    logger.error('child-process-gone:', details);
  });
}

logger.info('==================================================');
logger.info(`GitBox main starting (dev=${isDev}, pid=${process.pid})`);
logger.info(`log file: ${LOG_FILE}`);

module.exports = { logger, instrumentIpc, installCrashHandlers };

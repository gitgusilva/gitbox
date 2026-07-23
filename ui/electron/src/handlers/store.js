const { ipcMain } = require('electron');
const fs = require('fs');

module.exports = function (app, storePath) {
    // In-memory cache: read the file ONCE, then serve sync gets from memory and
    // persist writes asynchronously (debounced). Previously every get/set/delete
    // read+parsed and re-wrote the entire file synchronously — with a large store
    // that blocked the main process on every call.
    let cache = null;
    function getStore() {
        if (cache) return cache;
        try { cache = JSON.parse(fs.readFileSync(storePath, 'utf-8')); }
        catch (e) {
            // Unreadable but non-empty means damaged, not absent. Starting from
            // {} is right (the app must open), but the next write would erase
            // whatever was in there — keep a copy so it can be recovered.
            try {
                if (fs.existsSync(storePath) && fs.statSync(storePath).size > 0) {
                    fs.copyFileSync(storePath, `${storePath}.corrupt`);
                    console.error('[Store] unreadable config kept at', `${storePath}.corrupt`);
                }
            } catch (_) { /* best effort */ }
            cache = {};
        }
        return cache;
    }

    let writeTimer = null;
    function scheduleWrite() {
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(flush, 500);
    }
    function flush() {
        if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
        // Write to a sibling temp file and rename over the target: rename is
        // atomic, so a crash or a kill mid-write can no longer leave a truncated
        // (0-byte) config behind — which silently wiped every setting, including
        // the connected accounts, and made remote operations fail to authenticate.
        const tmp = `${storePath}.tmp`;
        try {
            fs.writeFileSync(tmp, JSON.stringify(cache || {}));
            fs.renameSync(tmp, storePath);
        } catch (e) {
            console.error('[Store] write failed:', e);
            try { fs.unlinkSync(tmp); } catch (_) { /* nothing to clean up */ }
        }
    }

    ipcMain.on('store:get', (event, key) => {
        event.returnValue = getStore()[key];
    });
    ipcMain.on('store:set', (event, key, value) => {
        try {
            getStore()[key] = value;
            scheduleWrite();
            event.returnValue = true;
        } catch (e) {
            console.error(`[Store] Failed to save key ${key}:`, e);
            event.returnValue = false;
        }
    });
    ipcMain.on('store:delete', (event, key) => {
        delete getStore()[key];
        scheduleWrite();
        event.returnValue = true;
    });

    // Make sure pending writes are flushed before the app exits.
    app.on('before-quit', flush);
};

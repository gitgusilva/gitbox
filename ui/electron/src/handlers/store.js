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
        catch (e) { cache = {}; }
        return cache;
    }

    let writeTimer = null;
    function scheduleWrite() {
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(flush, 500);
    }
    function flush() {
        if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
        try { fs.writeFileSync(storePath, JSON.stringify(cache || {})); }
        catch (e) { console.error('[Store] write failed:', e); }
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

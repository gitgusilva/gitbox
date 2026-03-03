const { ipcMain } = require('electron');
const fs = require('fs');

module.exports = function (app, storePath) {
    function getStore() {
        try { return JSON.parse(fs.readFileSync(storePath, 'utf-8')); }
        catch (e) { return {}; }
    }
    function saveStore(data) {
        try { fs.writeFileSync(storePath, JSON.stringify(data, null, 2)); }
        catch (e) { }
    }

    ipcMain.on('store:get', (event, key) => {
        event.returnValue = getStore()[key];
    });
    ipcMain.on('store:set', (event, key, value) => {
        try {
            const store = getStore();
            store[key] = value;
            saveStore(store);
            event.returnValue = true;
        } catch (e) {
            console.error(`[Store] Failed to save key ${key}:`, e);
            event.returnValue = false;
        }
    });
    ipcMain.on('store:delete', (event, key) => {
        const store = getStore();
        delete store[key];
        saveStore(store);
        event.returnValue = true;
    });
};

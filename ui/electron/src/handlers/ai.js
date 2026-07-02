const { ipcMain } = require('electron');
const { discoverAiClis } = require('../ai/discovery');
const { runAiCli } = require('../ai/runner');

/**
 * IPC for AI CLI providers: discovery (which registered CLIs are installed,
 * searching PATH + common install dirs) and running one headlessly.
 */
module.exports = function registerAiHandlers() {
    ipcMain.handle('gitbox:detectAiClis', async () => {
        return discoverAiClis().map(c => ({ id: c.id, label: c.label, vendor: c.vendor }));
    });

    ipcMain.handle('gitbox:aiRunCli', async (_, cliId, prompt) => runAiCli(cliId, prompt));
};

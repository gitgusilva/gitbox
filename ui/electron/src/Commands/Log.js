/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Log Command Class
 */
class Log extends Command {

    /**
     * Get repository commit history
     */
    async getLog(repoPath, maxCount, refName, skip) {
        return this.addon.log(repoPath, maxCount, refName, skip || 0);
    }
}

module.exports = Log;
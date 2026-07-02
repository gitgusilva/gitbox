/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Status Command Class
 */
class Status extends Command {

    /**
     * Get current repository status
     */
    async get(repoPath) {
        return this.addon.status(repoPath);
    }
}

module.exports = Status;
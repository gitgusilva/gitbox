/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Config Command Class
 */
class Config extends Command {

    /**
     * Get git configuration (user.name/email)
     */
    async get(repoPath) {
        return this.addon.getConfig(repoPath);
    }

    /**
     * Set git configuration
     */
    async set(repoPath, name, email) {
        return this.addon.setConfig(repoPath, name, email);
    }

    /**
     * Get global git configuration (~/.gitconfig user.name/email)
     */
    async getGlobal() {
        return this.addon.getGlobalConfig();
    }

    /**
     * Set global git configuration (~/.gitconfig user.name/email)
     */
    async setGlobal(name, email) {
        return this.addon.setGlobalConfig(name, email);
    }
}

module.exports = Config;
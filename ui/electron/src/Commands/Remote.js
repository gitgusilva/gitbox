/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Remote Command Class
 */
class Remote extends Command {

    /**
     * Get list of remotes
     */
    async getRemotes(repoPath) {
        return this.addon.remotes(repoPath);
    }

    /**
     * Get URL for a specific remote
     */
    async getUrl(repoPath, remoteName) {
        const { resolveRemoteUrl } = require('./AuthUtils');
            return await resolveRemoteUrl(repoPath, remoteName);
    }
}

module.exports = Remote;
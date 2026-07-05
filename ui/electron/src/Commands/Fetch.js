/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Fetch Command Class
 */
class Fetch extends Command {

    /**
     * Fetch changes from remote
     */
    async execute(repoPath, remoteName) {
        const { getTokenForRemote } = require('./AuthUtils');
            try {
                const remote = remoteName || 'origin';
                const token = getTokenForRemote(this.addon, repoPath, remote);
                return this.addon.fetch(repoPath, remote, token);
            } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Fetch;
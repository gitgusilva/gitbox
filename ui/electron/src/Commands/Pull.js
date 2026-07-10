/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Pull Command Class
 */
class Pull extends Command {

    /**
     * Pull changes from remote
     */
    async execute(repoPath, remoteName) {
        const { getTokenForRemote } = require('./AuthUtils');
            try {
                const remote = remoteName || 'origin';
                const token = getTokenForRemote(this.addon, repoPath, remote);
                // addon.pull now returns a Promise (runs off the main thread).
                return await this.addon.pull(repoPath, remote, token);
            } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Pull;
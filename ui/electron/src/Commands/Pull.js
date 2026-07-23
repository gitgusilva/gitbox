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
        const { remoteAuth, explainAuthError } = require('./AuthUtils');
        const remote = remoteName || 'origin';
        const { url, token, username, source } = await remoteAuth(this.addon, repoPath, remote);
        try {
            // addon.pull now returns a Promise (runs off the main thread).
            return await this.addon.pull(repoPath, remote, token, username);
        } catch (e) { throw explainAuthError(e, url, 'pull from', source); }
    }
}

module.exports = Pull;
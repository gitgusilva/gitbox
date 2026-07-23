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
        const { remoteAuth, explainAuthError } = require('./AuthUtils');
        const remote = remoteName || 'origin';
        const { url, token, username, source } = await remoteAuth(this.addon, repoPath, remote);
        try {
            // addon.fetch now returns a Promise (runs off the main thread) — await
            // so failures are caught here and surfaced with a clean message.
            return await this.addon.fetch(repoPath, remote, token, username);
        } catch (e) { throw explainAuthError(e, url, 'fetch from', source); }
    }
}

module.exports = Fetch;
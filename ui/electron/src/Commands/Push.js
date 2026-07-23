/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Push Command Class
 */
class Push extends Command {

    /**
     * Push changes to remote
     */
    async execute(repoPath, remoteName, branchName, setUpstream, force, pushTags, forceWithLease) {
        const { remoteAuth, explainAuthError } = require('./AuthUtils');
        const remote = remoteName || 'origin';
        const { url, token, username, source } = await remoteAuth(this.addon, repoPath, remote);
        try {
            // addon.push now returns a Promise (runs off the main thread).
            return await this.addon.push(repoPath, remote, token, branchName || '', !!force, !!pushTags, !!setUpstream, !!forceWithLease, username);
        } catch (e) {
            throw explainAuthError(e, url, 'push to', source);
        }
    }
}

module.exports = Push;
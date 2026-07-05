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
    async execute(repoPath, remoteName, branchName, setUpstream, force, pushTags) {
        const { getTokenForRemote } = require('./AuthUtils');
            try {
                const remote = remoteName || 'origin';
                const token = getTokenForRemote(this.addon, repoPath, remote);
                return this.addon.push(repoPath, remote, token, branchName || '', !!force, !!pushTags, !!setUpstream);
            } catch (e) {
                throw new Error(e.message);
            }
    }
}

module.exports = Push;
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
        const { resolveRemoteUrl, getAuthUrl } = require('./AuthUtils');
            try {
                const remote = remoteName || 'origin';
                const remoteUrl = await resolveRemoteUrl(repoPath, remote);
                const authUrl = await getAuthUrl(remoteUrl);
                const useAuthUrl = authUrl !== remoteUrl;

                const args = ['push'];
                if (setUpstream) args.push('-u');
                if (force) args.push('--force');
                if (pushTags) args.push('--tags');

                if (useAuthUrl) {
                    args.push(authUrl);
                    if (branchName) args.push(`HEAD:${branchName}`);
                } else if (remoteName) {
                    args.push(remoteName);
                    if (branchName) args.push(branchName);
                }

                await this.execGit(repoPath, args, { timeout: 60000 });
                return true;
            } catch (e) {
                throw new Error(e.message);
            }
    }
}

module.exports = Push;
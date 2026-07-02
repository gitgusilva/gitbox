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
        const { resolveRemoteUrl, getAuthUrl } = require('./AuthUtils');
            try {
                const remote = remoteName || 'origin';
                const remoteUrl = await resolveRemoteUrl(repoPath, remote);
                const authUrl = await getAuthUrl(remoteUrl);
                const target = authUrl !== remoteUrl ? authUrl : remote;
                await this.execGit(repoPath, ['pull', target], { timeout: 60000 });
                return true;
            } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Pull;
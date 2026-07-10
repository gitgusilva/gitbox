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

    /**
     * Add a new remote (git remote add <name> <url>)
     */
    async add(repoPath, name, url) {
        try { await this.execGit(repoPath, ['remote', 'add', name, url]); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Remove a remote (git remote remove <name>)
     */
    async remove(repoPath, name) {
        try { await this.execGit(repoPath, ['remote', 'remove', name]); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Rename a remote (git remote rename <old> <new>)
     */
    async rename(repoPath, oldName, newName) {
        try { await this.execGit(repoPath, ['remote', 'rename', oldName, newName]); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Change a remote's URL (git remote set-url <name> <url>)
     */
    async setUrl(repoPath, name, url) {
        try { await this.execGit(repoPath, ['remote', 'set-url', name, url]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Remote;
/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Stash Command Class
 */
class Stash extends Command {

    /**
     * Get list of stashes
     */
    async getStashes(repoPath) {
        return this.addon.stashes(repoPath);
    }

    /**
     * Save local changes to a new stash
     */
    async save(repoPath, message) {
        try { await this.execGit(repoPath, message ? ['stash', 'push', '-m', message] : ['stash', 'push']); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Apply and drop a stash entry
     */
    async pop(repoPath, stashId) {
        try { await this.execGit(repoPath, stashId ? ['stash', 'pop', stashId] : ['stash', 'pop']); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Drop a stash entry
     */
    async drop(repoPath, stashId) {
        try { await this.execGit(repoPath, stashId ? ['stash', 'drop', stashId] : ['stash', 'drop']); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Get list of files changed in a stash
     */
    async changes(repoPath, stashId) {
        return this.addon.stashChanges(repoPath, stashId);
    }
}

module.exports = Stash;
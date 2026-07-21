/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Add Command Class
 */
class Add extends Command {

    /**
     * Stage all changes
     */
    async all(repoPath) {
        return this.addon.stageAll(repoPath);
    }

    /**
     * Stage a specific file.
     *
     * Paths git no longer reports are dropped first: the selection comes from a
     * rendered list that may be a moment out of date, and a stale pathspec makes
     * `git add` fail loudly for something the user cannot act on anyway.
     */
    async file(repoPath, filePath) {
        const paths = await this.livePaths(repoPath, filePath);
        if (paths.length === 0) return false;
        try { await this.execGit(repoPath, ['add', '--', ...paths]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Add;
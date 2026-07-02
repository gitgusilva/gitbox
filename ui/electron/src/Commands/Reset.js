/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Reset Command Class
 */
class Reset extends Command {

    /**
     * Unstage all changes
     */
    async all(repoPath) {
        return this.addon.unstageAll(repoPath);
    }

    /**
     * Unstage a specific file
     */
    async file(repoPath, filePath) {
        try { await this.execGit(repoPath, ['reset', 'HEAD', '--', filePath]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Reset;
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
     * Stage a specific file
     */
    async file(repoPath, filePath) {
        try { await this.execGit(repoPath, ['add', '--', filePath]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Add;
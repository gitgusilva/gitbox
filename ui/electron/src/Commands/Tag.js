/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Tag Command Class
 */
class Tag extends Command {

    /**
     * Get all tags
     */
    async getTags(repoPath) {
        return this.addon.tags(repoPath);
    }

    /**
     * Create a new tag
     */
    async create(repoPath, tagName, commitSha) {
        const target = commitSha ? commitSha : 'HEAD';
            await this.execGit(repoPath, ['tag', tagName, target]);
    }

    /**
     * Delete a tag (git tag -d)
     */
    async delete(repoPath, tagName) {
        try { await this.execGit(repoPath, ['tag', '-d', tagName]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Tag;
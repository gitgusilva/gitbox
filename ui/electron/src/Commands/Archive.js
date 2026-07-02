/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Archive Command Class
 */
class Archive extends Command {

    /**
     * Create an archive of a specific commit
     */
    async create(repoPath, commitSha, format, outputPath) {
        try { await this.execGit(repoPath, ['archive', `--format=${format || 'zip'}`, '-o', outputPath, commitSha]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Archive;
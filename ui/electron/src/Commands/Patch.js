/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Patch Command Class
 */
class Patch extends Command {

    /**
     * Generate a patch file from a specific commit
     */
    async create(repoPath, commitSha, outputPath) {
        // No shell redirect: capture --stdout and write the file ourselves.
        try {
            const fs = require('fs');
            const { stdout } = await this.execGit(repoPath, ['format-patch', '-1', commitSha, '--stdout'], { maxBuffer: 1024 * 1024 * 15 });
            fs.writeFileSync(outputPath, stdout);
            return true;
        } catch (e) { throw new Error(e.message); }
    }

    /**
     * Apply a patch file to the repository
     */
    async apply(repoPath, patchPath) {
        try { await this.execGit(repoPath, ['apply', patchPath]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Patch;
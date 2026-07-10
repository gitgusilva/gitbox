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

    /**
     * Reset the current branch to an arbitrary commit.
     * @param {string} mode  'soft' | 'mixed' | 'hard'
     *   soft  — move HEAD only, keep index + working tree
     *   mixed — move HEAD + reset index, keep working tree (default git behavior)
     *   hard  — move HEAD + reset index + working tree (DESTRUCTIVE, discards changes)
     */
    async toCommit(repoPath, commitSha, mode = 'mixed') {
        const allowed = { soft: '--soft', mixed: '--mixed', hard: '--hard' };
        const flag = allowed[mode];
        if (!flag) throw new Error(`Invalid reset mode: ${mode}`);
        try { await this.execGit(repoPath, ['reset', flag, commitSha]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Reset;
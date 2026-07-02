/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Branch Command Class
 */
class Branch extends Command {

    /**
     * Get all branches (local and remote)
     */
    async getBranches(repoPath) {
        const branches = await this.addon.branches(repoPath); return branches.filter(b => !(b.is_remote && b.name.endsWith("/HEAD")));
    }

    async create(repoPath, branchName, startPoint = '') {
        const args = startPoint ? ['checkout', '-b', branchName, startPoint] : ['checkout', '-b', branchName];
        try { await this.execGit(repoPath, args); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Delete a branch
     */
    async delete(repoPath, branchName) {
        try { await this.execGit(repoPath, ['branch', '-D', branchName]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Branch;
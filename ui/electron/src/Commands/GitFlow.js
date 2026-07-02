/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * GitFlow Command Class
 */
class GitFlow extends Command {

    /**
     * Initialize git-flow in the repository
     */
    async init(repoPath) {
        try { await this.execGit(repoPath, ['flow', 'init', '-d']); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Start a new git-flow branch (feature, release, hotfix)
     */
    async start(repoPath, type, name) {
        try { await this.execGit(repoPath, ['flow', type, 'start', name]); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Finish a git-flow branch (merge into master/develop)
     */
    async finish(repoPath, type, name) {
        try { await this.execGit(repoPath, ['flow', type, 'finish', name]); return true; } catch (e) { throw new Error(e.message); }
    }
}

module.exports = GitFlow;
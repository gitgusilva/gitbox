/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Commit Command Class
 */
class Commit extends Command {

    /**
     * Commit all staged changes
     */
    async all(repoPath, message) {
        return this.addon.commitAll(repoPath, message);
    }

    /**
     * Get list of files in a commit
     */
    async files(repoPath, commitId) {
        return this.addon.commitFiles(repoPath, commitId);
    }

    /**
     * Change the message of the latest commit (HEAD)
     */
    async reword(repoPath, commitSha, newMessage) {
        const { stdout: headSha } = await this.execGit(repoPath, ['rev-parse', 'HEAD']);
            if (headSha.trim() === commitSha) {
                await this.execGit(repoPath, ['commit', '--amend', '-m', newMessage]);
            } else {
                throw new Error('Reword only supported for the latest commit (HEAD) for now.');
            }
    }

    /**
     * Squash the latest commit into its parent
     */
    async squash(repoPath, commitSha) {
        const { stdout: headSha } = await this.execGit(repoPath, ['rev-parse', 'HEAD']);
            if (headSha.trim() === commitSha) {
                await this.execGit(repoPath, ['reset', '--soft', 'HEAD~1']);
            } else {
                throw new Error('Squash only supported for the latest commit (HEAD) for now.');
            }
    }

    /**
     * Revert a specific commit
     */
    async revert(repoPath, commitSha) {
        await this.execGit(repoPath, ['revert', '--no-edit', commitSha]);
    }

    /**
     * Amend current staged changes to the last commit
     */
    async amend(repoPath, message) {
        await this.execGit(repoPath, message ? ['commit', '--amend', '-m', message] : ['commit', '--amend', '--no-edit']);
    }
}

module.exports = Commit;
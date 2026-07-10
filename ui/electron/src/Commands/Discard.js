/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Discard Command Class
 */
class Discard extends Command {

    /**
     * Discard all local changes
     */
    async all(repoPath) {
        return this.addon.discardAll(repoPath);
    }

    /**
     * Discard local changes for a specific file
     */
    async file(repoPath, filePath) {
        try {
                await this.execGit(repoPath, ['checkout', 'HEAD', '--', filePath]).catch(() => { });
                // NOTE: intentionally NOT using `-x` here. `-x` would also delete
                // git-ignored files (e.g. .env, node_modules, build output), which
                // is irreversible data loss the user never asked for. `-dfq` removes
                // only untracked files/dirs for this path.
                await this.execGit(repoPath, ['clean', '-dfq', '--', filePath]).catch(() => { });
                await this.execGit(repoPath, ['checkout', '--', filePath]).catch(() => { });
                return true;
            } catch (e) { throw new Error(e.message); }
    }
}

module.exports = Discard;
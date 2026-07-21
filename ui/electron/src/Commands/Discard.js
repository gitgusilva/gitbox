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
     * Discard local changes for a specific file.
     *
     * The path is inspected first so only the command that can actually apply is
     * run. Firing checkout AND clean at every path did work — the failures were
     * swallowed — but discarding an untracked file still logged two
     * "pathspec did not match any file(s) known to git" errors, which is what
     * filled the Command Log with red entries for operations that succeeded.
     */
    async file(repoPath, filePath) {
        const { stdout } = await this.execGit(repoPath, ['status', '--porcelain', '--', filePath], { probe: true });
        // Porcelain marks a path git has never seen with '??'.
        const isUntracked = (stdout.split('\n').find(Boolean) || '').startsWith('??');

        if (isUntracked) {
            // NOTE: intentionally NOT using `-x` here. `-x` would also delete
            // git-ignored files (e.g. .env, node_modules, build output), which is
            // irreversible data loss the user never asked for. `-dfq` removes only
            // untracked files/dirs for this path.
            await this.execGit(repoPath, ['clean', '-dfq', '--', filePath]);
            return true;
        }

        // Tracked: restore the index entry and the working-tree copy in one go, so
        // a staged change is discarded as well.
        await this.execGit(repoPath, ['checkout', 'HEAD', '--', filePath]);
        return true;
    }
}

module.exports = Discard;

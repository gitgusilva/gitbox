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
     * Runs entirely through libgit2. The previous implementation shelled out to
     * `git checkout HEAD -- <path>` / `git clean`, which packaged GitBox cannot
     * rely on (no system git is shipped) and which surfaced raw CLI stderr —
     * "unable to create file …: Permission denied" with no explanation — when the
     * path belonged to another user. The addon picks the right operation from
     * whether HEAD knows the path and reports permission problems in full.
     */
    async file(repoPath, filePath) {
        return this.addon.discardFile(repoPath, filePath);
    }
}

module.exports = Discard;

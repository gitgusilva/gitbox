/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Stash Command Class
 */
class Stash extends Command {

    /**
     * Get list of stashes
     */
    async getStashes(repoPath) {
        return this.addon.stashes(repoPath);
    }

    /**
     * Save local changes to a new stash.
     *
     * Native, because the stash/pull/restore recovery offered when local changes
     * block a fast-forward has to work in a packaged build, where no system git
     * exists. Returns false — not an error — when there was nothing to stash.
     */
    async save(repoPath, message) {
        return this.addon.stashSave(repoPath, message);
    }

    /**
     * Apply a stash entry without dropping it
     */
    async apply(repoPath, stashId) {
        try { await this.execGit(repoPath, stashId ? ['stash', 'apply', stashId] : ['stash', 'apply']); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Apply and drop a stash entry
     */
    async pop(repoPath, stashId) {
        return this.addon.stashPop(repoPath, stashId);
    }

    /**
     * Drop a stash entry.
     * The UI passes the stash commit OID; `git stash drop` only accepts
     * stash@{n}, so resolve the OID to its position in the list first. It has
     * to be `index`, not `id`: git reads whatever is inside `stash@{...}` as a
     * date when it is not a number, so `stash@{<oid>}` reports success and
     * drops nothing.
     */
    async drop(repoPath, stashId) {
        try {
            let ref;
            if (stashId) {
                const stashes = await this.getStashes(repoPath);
                const entry = stashes.find((s) => s.id === stashId);
                if (!entry) throw new Error(`stash entry not found: ${stashId}`);
                ref = `stash@{${entry.index}}`;
            }
            await this.execGit(repoPath, ref ? ['stash', 'drop', ref] : ['stash', 'drop']);
            return true;
        } catch (e) { throw new Error(e.message); }
    }

    /**
     * Get list of files changed in a stash
     */
    async changes(repoPath, stashId) {
        return this.addon.stashChanges(repoPath, stashId);
    }
}

module.exports = Stash;
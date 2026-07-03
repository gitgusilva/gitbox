/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');
const fs = require('fs');
const path = require('path');

/**
 * Merge Command Class
 */
class Merge extends Command {

    /**
     * Check for merge conflicts between branches
     */
    async check(repoPath, toBranch, fromBranch) {
        try {
                const b1 = toBranch;
                const b2 = fromBranch;
                await this.execGit(repoPath, ['merge-base', b1, b2]);
                try {
                    const { stdout } = await this.execGit(repoPath, ['merge-tree', '--name-only', '--write-tree', b1, b2]);
                    const lines = stdout.trim().split('\n');
                    if (lines.length > 1) {
                        const files = lines.slice(1).filter(l => l.trim() !== '');
                        return { hasConflicts: true, files };
                    }
                    return { hasConflicts: false, files: [] };
                } catch (err) {
                    const lines = (err.stdout || '').trim().split('\n');
                    if (lines.length > 1) {
                        const files = lines.slice(1).filter(l => l.trim() !== '');
                        return { hasConflicts: true, files };
                    }
                    return { hasConflicts: true, files: [] };
                }
            } catch (e) {
                return { hasConflicts: false, files: [] };
            }
    }

    /**
     * Merge a local (or remote-tracking) branch into the current branch using
     * libgit2. Returns { status, conflicts?, commit? }:
     *  - 'up_to_date'  : nothing to merge
     *  - 'fast_forward': HEAD moved forward, no merge commit
     *  - 'merged'      : clean merge, merge commit created
     *  - 'conflicts'   : conflicts written to the working tree; resolve, then complete()
     */
    async branch(repoPath, branchName, noFastForward = false) {
        return this.addon.mergeBranch(repoPath, branchName, !!noFastForward);
    }

    /**
     * Finalize a conflicted merge after the user resolved + staged everything.
     * Creates a merge commit (HEAD + MERGE_HEAD) and clears the merge state.
     */
    async complete(repoPath, message) {
        return this.addon.mergeContinue(repoPath, message || 'Merge');
    }

    /**
     * Abort an in-progress merge: hard-reset to HEAD and clear merge state.
     */
    async abort(repoPath) {
        return this.addon.mergeAbort(repoPath);
    }

    /**
     * Returns the repository state: 'clean' | 'merge' | 'rebase' | 'revert' | ...
     */
    async state(repoPath) {
        return this.addon.repoState(repoPath);
    }

    /** Two-letter porcelain codes that mark an unmerged (conflicted) path. */
    static UNMERGED = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

    /**
     * Map every conflicted path to its two-letter conflict code (UU, DU, UD, …)
     * via `git status --porcelain`. Read-only; the native status flattens all
     * conflicts to "conflicted", so this recovers the precise kind.
     */
    async conflictTypes(repoPath) {
        const map = {};
        try {
            const { stdout } = await this.execGit(repoPath, ['status', '--porcelain', '--untracked-files=no']);
            for (const line of stdout.split('\n')) {
                if (line.length < 4) continue;
                const xy = line.slice(0, 2);
                if (!Merge.UNMERGED.has(xy)) continue;
                let p = line.slice(3);
                if (p.startsWith('"') && p.endsWith('"')) { try { p = JSON.parse(p); } catch { /* keep raw */ } }
                map[p] = xy;
            }
        } catch { /* not a conflict / no repo */ }
        return map;
    }

    /**
     * Resolve one conflicted file by taking a whole side.
     *  - side 'ours'   = keep our version (or our deletion)
     *  - side 'theirs' = take their version (or their deletion)
     * Handles modify/modify and delete conflicts, then stages the result.
     */
    async resolveConflict(repoPath, filePath, side) {
        // 'both' keeps our version followed by theirs (like the merge editor's
        // "accept both"); only valid when both sides still have content.
        if (side === 'both') {
            const ours = await this.execGit(repoPath, ['show', `:2:${filePath}`]).then((r) => r.stdout).catch(() => '');
            const theirs = await this.execGit(repoPath, ['show', `:3:${filePath}`]).then((r) => r.stdout).catch(() => '');
            const merged = [ours.replace(/\n$/, ''), theirs.replace(/\n$/, '')].filter((s) => s.length).join('\n') + '\n';
            fs.writeFileSync(path.join(repoPath, filePath), merged);
            await this.execGit(repoPath, ['add', '--', filePath]);
            return true;
        }

        const { stdout } = await this.execGit(repoPath, ['status', '--porcelain', '--', filePath]);
        const xy = (stdout.slice(0, 2) || '').toUpperCase();
        const oursDeleted = xy[0] === 'D';
        const theirsDeleted = xy[1] === 'D';
        const wantDelete = side === 'ours' ? oursDeleted : theirsDeleted;
        if (wantDelete) {
            await this.execGit(repoPath, ['rm', '-f', '--', filePath]);
        } else {
            await this.execGit(repoPath, ['checkout', side === 'ours' ? '--ours' : '--theirs', '--', filePath]);
            await this.execGit(repoPath, ['add', '--', filePath]);
        }
        return true;
    }

    /** The incoming branch/ref being merged, parsed from MERGE_MSG (best-effort). */
    async mergeInfo(repoPath) {
        const info = { incoming: '' };
        try {
            const { stdout } = await this.execGit(repoPath, ['rev-parse', '--git-path', 'MERGE_MSG']);
            const rel = stdout.trim();
            const p = path.isAbsolute(rel) ? rel : path.join(repoPath, rel);
            const msg = fs.readFileSync(p, 'utf8');
            const m = msg.match(/Merge (?:remote-tracking )?branch(?:es)? '([^']+)'/);
            if (m) info.incoming = m[1];
        } catch { /* not merging / no message */ }
        return info;
    }

    /**
     * Open external merge tool for a conflicted file.
     */
    async openTool(repoPath, filePath, toolName) {
        const hasCustomTool = toolName && toolName !== 'git_config_default';
        const args = ['mergetool', '--no-prompt'];
        if (hasCustomTool) args.push('-t', toolName);
        args.push(filePath);
        await this.execGit(repoPath, args, { maxBuffer: 1024 * 1024 * 15 });
        return true;
    }
}

module.exports = Merge;

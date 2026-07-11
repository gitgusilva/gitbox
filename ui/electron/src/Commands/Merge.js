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

    /** Abort an in-progress rebase: restore the branch to its pre-rebase state. */
    async rebaseAbort(repoPath) {
        return this.addon.rebaseAbort(repoPath);
    }

    /** Skip the current (stopped) patch and continue the rebase. */
    async rebaseSkip(repoPath) {
        return this.addon.rebaseSkip(repoPath);
    }

    /** Commit the resolved patch and continue the rebase. */
    async rebaseContinue(repoPath) {
        return this.addon.rebaseContinue(repoPath);
    }

    /**
     * Cherry-pick a commit onto the current branch.
     * Returns { status: 'done' | 'conflicts' }. On conflict, git leaves
     * CHERRY_PICK_HEAD + conflicts in the working tree; the caller drives the
     * banner (resolve → continue / skip / abort), reusing the merge-conflict UI.
     */
    async cherryPick(repoPath, commitSha) {
        try {
            await this.execGit(repoPath, ['cherry-pick', commitSha]);
            return { status: 'done' };
        } catch (e) {
            if (this.addon.repoState(repoPath) === 'cherrypick') return { status: 'conflicts' };
            throw new Error(e.message);
        }
    }

    /** Abort an in-progress cherry-pick: restore the pre-cherry-pick state. */
    async cherryPickAbort(repoPath) {
        try { await this.execGit(repoPath, ['cherry-pick', '--abort']); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Commit the resolved conflicts and finish the cherry-pick. `core.editor=true`
     * suppresses the commit-message editor so it never hangs headless.
     */
    async cherryPickContinue(repoPath) {
        try {
            await this.execGit(repoPath, ['-c', 'core.editor=true', 'cherry-pick', '--continue']);
            return { status: this.addon.repoState(repoPath) === 'cherrypick' ? 'conflicts' : 'done' };
        } catch (e) {
            if (this.addon.repoState(repoPath) === 'cherrypick') return { status: 'conflicts' };
            throw new Error(e.message);
        }
    }

    /** Skip the current commit (e.g. it became empty) and continue the cherry-pick. */
    async cherryPickSkip(repoPath) {
        try {
            await this.execGit(repoPath, ['cherry-pick', '--skip']);
            return { status: this.addon.repoState(repoPath) === 'cherrypick' ? 'conflicts' : 'done' };
        } catch (e) {
            if (this.addon.repoState(repoPath) === 'cherrypick') return { status: 'conflicts' };
            throw new Error(e.message);
        }
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
            const list = this.addon.conflictedFiles(repoPath) || [];
            for (const c of list) map[c.path] = c.code;
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
        // Native: reads the index conflict stages, writes the chosen side to the
        // working tree and stages it (handles modify/modify, both, and delete).
        return this.addon.resolveConflict(repoPath, filePath, side);
    }

    /** The incoming branch/ref being merged, parsed from MERGE_MSG (best-effort). */
    async mergeInfo(repoPath) {
        const info = { incoming: '' };
        try {
            // Read .git/MERGE_MSG directly (no git CLI).
            const p = path.join(repoPath, '.git', 'MERGE_MSG');
            const msg = fs.readFileSync(p, 'utf8');
            const m = msg.match(/Merge (?:remote-tracking )?branch(?:es)? '([^']+)'/);
            if (m) info.incoming = m[1];
        } catch { /* not merging / no message */ }
        return info;
    }

    /**
     * Open external merge tool for a conflicted file.
     *
     * VS Code and its forks (VSCodium, Cursor, Windsurf, Insiders, Antigravity)
     * are NOT git built-in mergetools — `git mergetool -t code` fails with
     * "mergetool.code.cmd not set". We inject the launch command inline via
     * `-c mergetool.<id>.cmd=...` so it works regardless of the user's git config.
     * All of these accept `--wait --merge <remote> <local> <base> <merged>`.
     * Other tools (meld, kdiff3, …) keep using git's own built-in definition.
     */
    async openTool(repoPath, filePath, toolName) {
        const hasCustomTool = toolName && toolName !== 'git_config_default';
        // Tool id -> launch binary for the VS Code family (id and binary differ
        // only for VSCodium). Mirrors the vscodeFamily list in handlers/system.js.
        const VSCODE_FAMILY = {
            code: 'code',
            'code-insiders': 'code-insiders',
            vscodium: 'codium',
            cursor: 'cursor',
            windsurf: 'windsurf',
            antigravity: 'antigravity',
        };
        const args = [];
        if (hasCustomTool && VSCODE_FAMILY[toolName]) {
            const cmd = `${VSCODE_FAMILY[toolName]} --wait --merge "$REMOTE" "$LOCAL" "$BASE" "$MERGED"`;
            args.push('-c', `mergetool.${toolName}.cmd=${cmd}`);
            // GUI editor exits 0 on close; trust that instead of prompting the user.
            args.push('-c', `mergetool.${toolName}.trustExitCode=true`);
        }
        args.push('mergetool', '--no-prompt');
        if (hasCustomTool) args.push('-t', toolName);
        args.push(filePath);
        await this.execGit(repoPath, args, { maxBuffer: 1024 * 1024 * 15 });
        return true;
    }
}

module.exports = Merge;

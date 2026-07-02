/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Diff Command Class
 */
class Diff extends Command {

    /**
     * Get diff for a specific file (including image support)
     */
    async file(repoPath, filePath) {
        if (this.isImage(filePath)) {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.join(repoPath, filePath);
                let original = '';
                try {
                    const { stdout } = await this.execGit(repoPath, ['show', `HEAD:${filePath}`], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 15 });
                    original = stdout.toString('base64');
                } catch (e) { }
                let modified = '';
                try {
                    if (fs.existsSync(fullPath)) {
                        modified = fs.readFileSync(fullPath).toString('base64');
                    }
                } catch (e) { }
                return { original, modified };
            }
            return this.addon.diffFile(repoPath, filePath);
    }

    /**
     * Get diff for a file within a stash entry
     */
    async stashFile(repoPath, stashId, filePath) {
        const _isImg = this.isImage(filePath);
            const opts = { maxBuffer: 1024 * 1024 * 15 };
            if (_isImg) opts.encoding = 'buffer';
            let original = '';
            try {
                const { stdout } = await this.execGit(repoPath, ['show', `${stashId}^:${filePath}`], opts);
                original = _isImg ? stdout.toString('base64') : stdout;
            } catch (e) { }
            let modified = '';
            try {
                const { stdout } = await this.execGit(repoPath, ['show', `${stashId}:${filePath}`], opts);
                modified = _isImg ? stdout.toString('base64') : stdout;
            } catch (e) {
                try {
                    const { stdout } = await this.execGit(repoPath, ['show', `${stashId}^3:${filePath}`], opts);
                    modified = _isImg ? stdout.toString('base64') : stdout;
                } catch (err2) { }
            }
            return { path: filePath, original, modified };
    }

    /**
     * Get diff for a file at a specific commit
     */
    async commitFile(repoPath, commitId, filePath) {
        try {
                const _isImg = this.isImage(filePath);
                const opts = { maxBuffer: 1024 * 1024 * 15, timeout: 15000 };
                if (_isImg) opts.encoding = 'buffer';

                let original = '';
                try {
                    const { stdout } = await this.execGit(repoPath, ['show', `${commitId}^:${filePath}`], opts);
                    original = _isImg ? stdout.toString('base64') : stdout;
                } catch (e) { }

                let modified = '';
                try {
                    const { stdout } = await this.execGit(repoPath, ['show', `${commitId}:${filePath}`], opts);
                    modified = _isImg ? stdout.toString('base64') : stdout;
                } catch (e) { }

                return { path: filePath, original, modified };
            } catch (e) { return { path: filePath, original: '', modified: '' }; }
    }

    /**
     * Get current staged diff
     */
    async staged(repoPath) {
        try { const { stdout } = await this.execGit(repoPath, ['diff', '--staged'], { maxBuffer: 1024 * 1024 * 5 }); return stdout; } catch (e) { return ''; }
    }

    /**
     * Get unstaged diff for a file
     */
    async localFile(repoPath, filePath) {
        try { const { stdout } = await this.execGit(repoPath, ['diff', '--', filePath], { maxBuffer: 1024 * 1024 * 5 }); return stdout; } catch (e) { return ''; }
    }

    /**
     * Full patch for a commit (message header + stat + diff) — used as context
     * for the AI "explain commit" feature.
     */
    async commitPatch(repoPath, commitId) {
        try {
            const { stdout } = await this.execGit(repoPath, ['show', '--stat', '--patch', '--no-color', commitId], { maxBuffer: 1024 * 1024 * 15 });
            return stdout;
        } catch (e) { return ''; }
    }
}

module.exports = Diff;
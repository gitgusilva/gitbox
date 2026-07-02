/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Submodule Command Class
 */
class Submodule extends Command {

    /**
     * Get list of submodules with status and URL
     */
    async get(repoPath) {
        try {
            const { stdout } = await this.execGit(repoPath, ['submodule', 'status'], { maxBuffer: 1024 * 1024 });
            const lines = stdout.split('\n').filter(l => l.trim().length > 0);
            let submodules = lines.map(line => {
                const parts = line.trim().split(' ');
                let status = 'clean';
                if (line.startsWith('-')) status = 'uninitialized';
                else if (line.startsWith('+')) status = 'modified';
                else if (line.startsWith('U')) status = 'conflicted';
                return { sha: parts[0].replace(/^[+-U]/, ''), path: parts[1], ref: parts[2] ? parts[2].replace(/[()]/g, '') : '', status };
            });
            try {
                const { stdout: statusOut } = await this.execGit(repoPath, ['status', '--porcelain=v1']);
                const statusLines = statusOut.split('\n').filter(l => l.trim());
                for (const line of statusLines) {
                    const statusCode = line.substring(0, 2);
                    const path = line.substring(3).trim();
                    const sub = submodules.find(s => s.path === path);
                    if (sub) {
                        if (statusCode.includes('A')) sub.status = 'uncommitted';
                        else if (statusCode !== '  ') sub.status = 'modified';
                    }
                }
            } catch (e) { }
            try {
                const { stdout: urlOut } = await this.execGit(repoPath, ['config', '-f', '.gitmodules', '--get-regexp', 'url']);
                const urlLines = urlOut.split('\n').filter(l => l.trim());
                for (const line of urlLines) {
                    const match = line.match(/submodule\.(.+)\.url (.+)/);
                    if (match) {
                        const path = match[1];
                        const url = match[2];
                        const sub = submodules.find(s => s.path === path);
                        if (sub) sub.url = url;
                    }
                }
            } catch (e) { }
            return submodules;
        } catch (e) {
            return [];
        }
    }

    /**
     * Add a new submodule
     */
    async add(repoPath, url, targetPath) {
        try {
            await this.execGit(repoPath, targetPath ? ['submodule', 'add', '--force', url, targetPath] : ['submodule', 'add', '--force', url], { timeout: 60000 });
            return true;
        } catch (e) {
            if (e.message.includes('does not have a commit checked out')) {
                const match = e.message.match(/fatal: '(.+)' does not have a commit checked out/);
                const folder = match ? match[1] : 'the target folder';
                throw new Error(`The folder "${folder}" already exists but is empty/corrupted. Please delete the "${folder}" folder in your project and try again.`);
            }
            throw new Error(e.message);
        }
    }

    /**
     * Delete a submodule
     */
    async delete(repoPath, submodulePath) {
        try {
            await this.execGit(repoPath, ['submodule', 'deinit', '-f', '--', submodulePath], { timeout: 60000 });
            await this.execGit(repoPath, ['rm', '-f', '--', submodulePath], { timeout: 60000 });
            // Remove the submodule's git dir with fs (not a shell `rm -rf`). Contain
            // the resolved path within .git/modules so a crafted submodulePath with
            // '..' can't delete arbitrary directories.
            const fs = require('fs');
            const path = require('path');
            const modulesRoot = path.resolve(repoPath, '.git', 'modules');
            const target = path.resolve(modulesRoot, submodulePath);
            if (target === modulesRoot || target.startsWith(modulesRoot + path.sep)) {
                fs.rmSync(target, { recursive: true, force: true });
            }
            return true;
        } catch (e) { throw new Error(e.message); }
    }

    /**
     * Update an existing submodule
     */
    async update(repoPath, submodulePath) {
        try { await this.execGit(repoPath, ['submodule', 'update', '--init', '--remote', '--', submodulePath], { timeout: 120000 }); return true; } catch (e) { throw new Error(e.message); }
    }

    /**
     * Get commit info for a specific SHA within a submodule
     */
    async getCommitInfo(repoPath, submodulePath, sha) {
        try {
            if (!sha || sha.length < 4) return null;
            const path = require('path');
            const fullSubmodulePath = path.join(repoPath, submodulePath);

            // Format: SHA, Author Name, Author Email, Author Date (Unix), Committer Name, Committer Email, Committer Date (Unix), Parents, Refs, Message (Full Body)
            const format = '%H%n%an%n%ae%n%at%n%cn%n%ce%n%ct%n%P%n%D%n%B';
            const { stdout } = await this.execGit(fullSubmodulePath, ['show', '-s', `--format=${format}`, sha], { maxBuffer: 1024 * 1024 });

            const lines = stdout.split('\n');
            return {
                sha: lines[0],
                authorName: lines[1],
                authorEmail: lines[2],
                authorTime: parseInt(lines[3]) * 1000,
                committerName: lines[4],
                committerEmail: lines[5],
                committerTime: parseInt(lines[6]) * 1000,
                parents: lines[7].split(' ').filter(p => p),
                refs: lines[8].split(',').map(r => r.trim()).filter(r => r),
                message: lines.slice(9).join('\n').trim()
            };
        } catch (e) {
            return null;
        }
    }
}

module.exports = Submodule;
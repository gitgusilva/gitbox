/**
 * @fileoverview Auto-generated Git Command class
 */
const Command = require('./Command');

/**
 * Blame Command Class
 */
class Blame extends Command {

    /**
     * Get file blame information
     */
    async file(repoPath, filePath, rev = '') {
        try {
                // `rev` (e.g. 'HEAD') lets us blame a committed version — needed for
                // the merge editor, since `git blame` refuses an unmerged worktree file.
                const args = rev
                    ? ['blame', '-p', rev, '--', filePath]
                    : ['blame', '-p', '--', filePath];
                const { stdout } = await this.execGit(repoPath, args, { maxBuffer: 1024 * 1024 * 10 });
                const lines = stdout.split('\n');
                const commits = {};
                const result = [];
                let currentCommit = null;
                let currentLine = 1;
                for (const line of lines) {
                    if (!line) continue;
                    if (!line.startsWith('\t')) {
                        const parts = line.split(' ');
                        if (parts[0].length === 40) {
                            currentCommit = parts[0];
                            if (!commits[currentCommit]) commits[currentCommit] = {};
                        } else if (currentCommit) {
                            const firstSpace = line.indexOf(' ');
                            const key = line.substring(0, firstSpace);
                            const val = line.substring(firstSpace + 1);
                            commits[currentCommit][key] = val;
                        }
                    } else {
                        result.push({
                            line: currentLine++,
                            commit: currentCommit,
                            author: commits[currentCommit]['author'] || 'Unknown',
                            email: (commits[currentCommit]['author-mail'] || '').replace(/[<>]/g, ''),
                            time: commits[currentCommit]['author-time'] || 0,
                            summary: commits[currentCommit]['summary'] || ''
                        });
                    }
                }
                return result;
            } catch (e) { return []; }
    }
}

module.exports = Blame;
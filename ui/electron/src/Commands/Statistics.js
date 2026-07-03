/**
 * @fileoverview Repository statistics: contributor breakdown, monthly
 * contributions and a repo overview (size / commits / branches / tags).
 * Everything is derived from a handful of injection-safe `git` calls.
 */
const Command = require('./Command');

const US = '\x1f'; // unit separator — safe field delimiter (never appears in git output)

/**
 * Statistics Command Class
 */
class Statistics extends Command {

    /**
     * Compute repository statistics.
     * @param {string} repoPath absolute repo path
     * @param {number} sinceMonths analysis window in months (0 / falsy = all history)
     */
    async compute(repoPath, sinceMonths = 12) {
        const [overview, contrib] = await Promise.all([
            this._overview(repoPath),
            this._contributions(repoPath, sinceMonths),
        ]);
        return { ...overview, ...contrib, sinceMonths: Number(sinceMonths) || 0 };
    }

    /** Repo-wide totals that don't depend on the analysis window. */
    async _overview(repoPath) {
        const out = {
            totalCommits: 0,
            branchCount: 0,
            remoteBranchCount: 0,
            tagCount: 0,
            sizeBytes: 0,
            objectCount: 0,
        };

        try {
            const { stdout } = await this.execGit(repoPath, ['rev-list', '--all', '--count']);
            out.totalCommits = parseInt(stdout.trim(), 10) || 0;
        } catch (e) { /* empty repo / no commits */ }

        try {
            const { stdout } = await this.execGit(repoPath, [
                'for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes', 'refs/tags',
            ]);
            for (const ref of stdout.split('\n')) {
                if (ref.startsWith('refs/heads/')) out.branchCount++;
                else if (ref.startsWith('refs/remotes/')) out.remoteBranchCount++;
                else if (ref.startsWith('refs/tags/')) out.tagCount++;
            }
        } catch (e) { /* ignore */ }

        try {
            // `-v` reports sizes in KiB; sum loose + packed for a real on-disk figure.
            const { stdout } = await this.execGit(repoPath, ['count-objects', '-v']);
            const map = {};
            for (const line of stdout.split('\n')) {
                const idx = line.indexOf(':');
                if (idx > 0) map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
            const sizeKiB = (parseInt(map['size'], 10) || 0) + (parseInt(map['size-pack'], 10) || 0);
            out.sizeBytes = sizeKiB * 1024;
            out.objectCount = (parseInt(map['count'], 10) || 0) + (parseInt(map['in-pack'], 10) || 0);
        } catch (e) { /* ignore */ }

        return out;
    }

    /**
     * Per-author, per-month, per-weekday and per-hour aggregation from a single
     * `git log --numstat` pass. `lines` counts churn (added + deleted), matching
     * how avg lines/commit reads. Month/weekday/hour are derived from `%at`
     * (commit epoch) in local time.
     */
    async _contributions(repoPath, sinceMonths) {
        const args = [
            'log', '--all', '--no-merges', '--numstat',
            `--pretty=format:C${US}%H${US}%an${US}%ae${US}%at`,
        ];
        if (Number(sinceMonths) > 0) args.push(`--since=${Number(sinceMonths)} months ago`);

        let stdout = '';
        try {
            ({ stdout } = await this.execGit(repoPath, args, { maxBuffer: 1024 * 1024 * 128 }));
        } catch (e) {
            return { authors: [], monthly: [], weekday: new Array(7).fill(0), hourly: new Array(24).fill(0), totalAdded: 0, totalDeleted: 0 };
        }

        const authors = new Map();     // key -> { name, email, commits, added, deleted, lines }
        const months = new Map();      // 'YYYY-MM' -> { month, total, commits, byAuthor: {name: lines} }
        const weekday = new Array(7).fill(0);   // 0 = Sunday
        const hourly = new Array(24).fill(0);
        let totalAdded = 0;
        let totalDeleted = 0;

        let curKey = null;
        let curName = null;
        let curMonth = null;

        const authorKey = (name, email) => (email && email.trim() ? email.trim().toLowerCase() : (name || 'Unknown'));

        for (const raw of stdout.split('\n')) {
            if (!raw) continue;

            if (raw[0] === 'C' && raw[1] === US) {
                const parts = raw.split(US);
                const name = parts[2] || 'Unknown';
                const email = parts[3] || '';
                const ts = parseInt(parts[4], 10) || 0;
                const d = new Date(ts * 1000);
                curMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                curKey = authorKey(name, email);
                curName = name;

                weekday[d.getDay()]++;
                hourly[d.getHours()]++;

                let a = authors.get(curKey);
                if (!a) { a = { name, email, commits: 0, added: 0, deleted: 0, lines: 0 }; authors.set(curKey, a); }
                a.commits++;
                a.name = name; // keep the latest display name for this identity

                let m = months.get(curMonth);
                if (!m) { m = { month: curMonth, total: 0, commits: 0, byAuthor: {} }; months.set(curMonth, m); }
                m.commits++;
                continue;
            }

            // numstat row: "added\tdeleted\tpath"; binary files report "-\t-".
            const tab = raw.indexOf('\t');
            if (tab < 0 || !curKey) continue;
            const cols = raw.split('\t');
            const added = cols[0] === '-' ? 0 : (parseInt(cols[0], 10) || 0);
            const deleted = cols[1] === '-' ? 0 : (parseInt(cols[1], 10) || 0);
            const churn = added + deleted;
            if (churn === 0) continue;

            totalAdded += added;
            totalDeleted += deleted;

            const a = authors.get(curKey);
            a.added += added;
            a.deleted += deleted;
            a.lines += churn;

            const m = months.get(curMonth);
            m.total += churn;
            m.byAuthor[curName] = (m.byAuthor[curName] || 0) + churn;
        }

        const authorList = [...authors.values()]
            .map((a) => ({ ...a, avgLinesPerCommit: a.commits > 0 ? Math.round(a.lines / a.commits) : 0 }))
            .sort((x, y) => y.lines - x.lines);

        const monthly = [...months.values()].sort((x, y) => (x.month < y.month ? -1 : 1));

        return { authors: authorList, monthly, weekday, hourly, totalAdded, totalDeleted };
    }
}

module.exports = Statistics;

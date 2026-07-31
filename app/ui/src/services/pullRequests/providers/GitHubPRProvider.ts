import { BasePRProvider } from './BasePRProvider';
import { PRReaction, PullRequest, PullRequestFile, PullRequestMetadata, ReactionTarget } from '../types';

/** Where each kind of reaction target lives in the REST API. */
function reactionsPath(repo: string, target: ReactionTarget) {
    switch (target.kind) {
        case 'issue_comment': return `https://api.github.com/repos/${repo}/issues/comments/${target.id}/reactions`;
        case 'review_comment': return `https://api.github.com/repos/${repo}/pulls/comments/${target.id}/reactions`;
        // A pull request is an issue as far as reactions are concerned.
        default: return `https://api.github.com/repos/${repo}/issues/${target.id}/reactions`;
    }
}

export class GitHubPRProvider extends BasePRProvider {
    async fetchPRs(repo: string, showClosed: boolean): Promise<PullRequest[]> {
        const stateParam = showClosed ? 'all' : 'open';
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls?state=${stateParam}&sort=updated&direction=desc`);

        if (!res.ok) {
            if (res.status === 404) throw new Error('github_404');

            if (res.status === 403 && res.data?.message?.includes('OAuth App access restrictions')) {
                throw new Error('github_oauth_restrictions');
            }

            throw new Error('github_error');
        }

        return res.data.map((pr: any) => this.mapPR(pr));
    }

    /**
     * GitHub reports a merged PR as `state: 'closed'`; the merge only shows in
     * `merged_at`. The UI needs to tell the two apart (a merged PR is not
     * reopenable and reads differently), so it is normalized here.
     */
    private mapPR(pr: any): PullRequest {
        return {
            id: pr.id,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            url: pr.html_url,
            state: pr.merged_at ? 'merged' : pr.state,
            user: {
                login: pr.user.login,
                avatar_url: pr.user.avatar_url
            },
            assignees: pr.assignees?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url })) || [],
            requestedReviewers: pr.requested_reviewers?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url })) || [],
            labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
            sourceBranch: pr.head?.ref,
            targetBranch: pr.base?.ref,
            // head.repo is null when the fork was deleted; fall back to the
            // target repo so the branch link still points somewhere sane.
            sourceRepoUrl: pr.head?.repo?.html_url || pr.base?.repo?.html_url,
            targetRepoUrl: pr.base?.repo?.html_url,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            baseSha: pr.base?.sha,
            headSha: pr.head?.sha,
            draft: pr.draft,
            nodeId: pr.node_id
        };
    }

    async closePR(repo: string, prNumber: number): Promise<boolean> {
        return this.updatePR(repo, prNumber, { state: 'closed' });
    }

    async convertToDraft(repo: string, prId: string): Promise<boolean> {
        const token = await this.getAccessToken();
        if (!token) return false;
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `mutation { convertPullRequestToDraft(input: {pullRequestId: "${prId}"}) { clientMutationId } }` })
        });
        return response.ok;
    }

    async updatePR(repo: string, prNumber: number, data: any): Promise<boolean> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.ok;
    }

    async submitReview(repo: string, prNumber: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body?: string): Promise<boolean> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, body: body || '' })
        });
        if (!res.ok) throw new Error(res.data?.message || 'review_failed');
        return true;
    }

    async fetchComments(repo: string, prNumber: number): Promise<any[]> {
        const token = await this.getAccessToken();
        if (!token) return [];
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.squirrel-girl-preview+json'
        };

        const [issueRes, reviewRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, { headers }),
            fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/comments`, { headers })
        ]);

        let comments: any[] = [];
        if (issueRes.ok) comments = comments.concat(await issueRes.json());
        if (reviewRes.ok) comments = comments.concat(await reviewRes.json());

        return comments.map((c: any) => ({
            id: c.id,
            body: c.body,
            user: { login: c.user.login, avatar_url: c.user.avatar_url },
            createdAt: c.created_at,
            url: c.html_url,
            reactions: c.reactions || null,
            // Review comments live under /pulls/comments and issue comments
            // under /issues/comments — reacting needs to know which.
            kind: c.pull_request_review_id || c.diff_hunk ? 'review_comment' : 'issue_comment',
            path: c.path
        })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    async addComment(repo: string, prNumber: number, body: string): Promise<boolean> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body })
        });
        return res.ok;
    }

    async fetchMetadata(repo: string): Promise<PullRequestMetadata> {
        const token = await this.getAccessToken();
        if (!token) return { users: [], labels: [] };
        const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

        const [usersRes, labelsRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${repo}/assignees?per_page=100`, { headers }),
            fetch(`https://api.github.com/repos/${repo}/labels?per_page=100`, { headers })
        ]);

        return {
            users: usersRes.ok ? await usersRes.json() : [],
            labels: labelsRes.ok ? await labelsRes.json() : []
        };
    }

    async updateReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<boolean> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls/${prNumber}/requested_reviewers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewers })
        });
        return res.ok;
    }

    async updateAssigneesAndLabels(repo: string, prNumber: number, assignees: string[], labels: string[]): Promise<boolean> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/issues/${prNumber}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignees, labels })
        });
        return res.ok;
    }

    async fetchPRDetails(repo: string, prNumber: number): Promise<any> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
            headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' }
        });
        return res.ok ? res.data : null;
    }

    async fetchBranches(repo: string): Promise<string[]> {
        const token = await this.getAccessToken();
        if (!token) return [];
        const res = await fetch(`https://api.github.com/repos/${repo}/branches`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.map((b: any) => b.name);
    }

    async createPR(repo: string, data: any): Promise<any> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: data.title,
                body: data.description,
                head: data.fromBranch,
                base: data.toBranch,
                draft: !!data.isDraft
            })
        });

        if (!res.ok) throw new Error(res.data?.message || 'Failed to create PR');
        return res.data;
    }

    normalizeDetails(raw: any): Partial<PullRequest> {
        if (!raw) return {};
        return {
            state: raw.merged_at ? 'merged' : raw.state,
            changed_files: raw.changed_files,
            additions: raw.additions,
            deletions: raw.deletions,
            commits: raw.commits,
            // null while GitHub is still computing the merge check.
            mergeable: raw.mergeable,
            baseSha: raw.base?.sha,
            headSha: raw.head?.sha,
            sourceRepoUrl: raw.head?.repo?.html_url,
            targetRepoUrl: raw.base?.repo?.html_url,
            updatedAt: raw.updated_at,
            reactions: raw.reactions,
        };
    }

    async fetchFiles(repo: string, prNumber: number): Promise<PullRequestFile[]> {
        const res = await this._fetchJSON(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100`);
        if (!res.ok) return [];

        return res.data.map((f: any) => ({
            path: f.filename,
            // GitHub also reports 'changed', 'copied' and 'unchanged'; everything
            // that is not one of the three we draw differently is a modification.
            status: ['added', 'removed', 'renamed'].includes(f.status) ? f.status : 'modified',
            previousPath: f.previous_filename,
            additions: f.additions ?? 0,
            deletions: f.deletions ?? 0,
            // GitHub omits the patch for binaries (and for very large diffs);
            // the viewer falls back to fetching both blobs in that case.
            binary: !f.patch && f.status !== 'removed' && f.status !== 'added',
        }));
    }

    async fetchFileContent(repo: string, path: string, ref: string): Promise<string | null> {
        const res = await this._fetchJSON(
            `https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
        );
        // 404 is the normal answer for a file that does not exist at this
        // commit (added on one side, deleted on the other).
        if (!res.ok || !res.data?.content) return null;
        return String(res.data.content).replace(/\n/g, '');
    }

    async fetchReactions(repo: string, target: ReactionTarget, viewerLogin?: string | null): Promise<PRReaction[]> {
        const res = await this._fetchJSON(`${reactionsPath(repo, target)}?per_page=100`);
        if (!res.ok || !Array.isArray(res.data)) return [];

        const grouped = new Map<string, PRReaction>();
        for (const r of res.data) {
            const entry: PRReaction = grouped.get(r.content) || { content: r.content, count: 0, users: [], viewerReactionId: null };
            entry.count += 1;
            if (r.user?.login) entry.users.push(r.user.login);
            if (viewerLogin && r.user?.login === viewerLogin) entry.viewerReactionId = r.id;
            grouped.set(r.content, entry);
        }
        return [...grouped.values()];
    }

    async addReaction(repo: string, target: ReactionTarget, content: string): Promise<boolean> {
        const res = await this._fetchJSON(reactionsPath(repo, target), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
        });
        // 200 means "you already reacted with this"; both are a success here.
        return res.ok;
    }

    async removeReaction(repo: string, target: ReactionTarget, reactionId: string | number): Promise<boolean> {
        const res = await this._fetchJSON(`${reactionsPath(repo, target)}/${reactionId}`, { method: 'DELETE' });
        return res.ok || res.status === 204;
    }
}

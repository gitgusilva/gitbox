import { BasePRProvider } from './BasePRProvider';
import { PullRequest, PullRequestMetadata } from '../types';

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

        return res.data.map((pr: any) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            url: pr.html_url,
            state: pr.state,
            user: {
                login: pr.user.login,
                avatar_url: pr.user.avatar_url
            },
            assignees: pr.assignees?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url })) || [],
            requestedReviewers: pr.requested_reviewers?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url })) || [],
            labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
            sourceBranch: pr.head.ref,
            targetBranch: pr.base.ref,
            createdAt: pr.created_at,
            draft: pr.draft,
            nodeId: pr.node_id
        }));
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
            reactions: c.reactions || null
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
}

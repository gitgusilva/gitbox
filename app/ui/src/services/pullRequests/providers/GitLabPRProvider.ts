import { BasePRProvider } from './BasePRProvider';
import { PullRequest, PullRequestMetadata } from '../types';

export class GitLabPRProvider extends BasePRProvider {
    async fetchPRs(repo: string, showClosed: boolean): Promise<PullRequest[]> {
        const encodedRepo = encodeURIComponent(repo);
        const stateParam = showClosed ? 'all' : 'opened';
        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests?state=${stateParam}&order_by=updated_at&sort=desc`);

        if (!res.ok) {
            if (res.status === 404) throw new Error('gitlab_404');
            throw new Error('gitlab_error');
        }

        return res.data.map((mr: any) => ({
            id: mr.id,
            number: mr.iid,
            title: mr.title,
            body: mr.description,
            url: mr.web_url,
            state: mr.state === 'opened' ? 'open' : mr.state,
            user: {
                login: mr.author.username,
                avatar_url: mr.author.avatar_url
            },
            assignees: mr.assignees?.map((a: any) => ({ login: a.username, avatar_url: a.avatar_url })) || [],
            requestedReviewers: mr.reviewers?.map((a: any) => ({ login: a.username, avatar_url: a.avatar_url })) || [],
            labels: mr.labels?.map((l: any) => ({ name: l, color: '#e24329' })) || [],
            sourceBranch: mr.source_branch,
            targetBranch: mr.target_branch,
            createdAt: mr.created_at,
            draft: mr.draft || mr.work_in_progress,
            nodeId: mr.id.toString()
        }));
    }

    async submitReview(_repo: string, _prNumber: number, _event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', _body?: string): Promise<boolean> {
        // GitLab uses a different approval model (approve/unapprove endpoints, no
        // "request changes" review event). Not wired up yet.
        throw new Error('review_not_supported');
    }

    async closePR(repo: string, prNumber: number): Promise<boolean> {
        return this.updatePR(repo, prNumber, { state_event: 'close' });
    }

    async convertToDraft(repo: string, prId: string): Promise<boolean> {
        const details = await this.fetchPRDetails(repo, Number(prId));
        if (details) {
            const title = details.title.startsWith('Draft:') ? details.title : `Draft: ${details.title}`;
            return this.updatePR(repo, details.iid, { title });
        }
        return false;
    }

    async updatePR(repo: string, prNumber: number, data: any): Promise<boolean> {
        const encodedRepo = encodeURIComponent(repo);
        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.ok;
    }

    async fetchComments(repo: string, prNumber: number): Promise<any[]> {
        const encodedRepo = encodeURIComponent(repo);
        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}/notes`);
        if (!res.ok) return [];
        return res.data.filter((c: any) => !c.system).map((c: any) => ({
            id: c.id,
            body: c.body,
            user: { login: c.author.username, avatar_url: c.author.avatar_url },
            createdAt: c.created_at,
            url: ''
        })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    async addComment(repo: string, prNumber: number, body: string): Promise<boolean> {
        const encodedRepo = encodeURIComponent(repo);
        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body })
        });
        return res.ok;
    }

    async fetchMetadata(repo: string): Promise<PullRequestMetadata> {
        const token = await this.getAccessToken();
        if (!token) return { users: [], labels: [] };
        const encodedRepo = encodeURIComponent(repo);
        const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' };

        const [usersRes, labelsRes] = await Promise.all([
            fetch(`https://gitlab.com/api/v4/projects/${encodedRepo}/users`, { headers }),
            fetch(`https://gitlab.com/api/v4/projects/${encodedRepo}/labels`, { headers })
        ]);

        return {
            users: usersRes.ok ? await usersRes.json() : [],
            labels: labelsRes.ok ? await labelsRes.json() : []
        };
    }

    async updateReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<boolean> {
        // Find reviewer user IDs using their usernames
        const encodedRepo = encodeURIComponent(repo);
        const metadata = await this.fetchMetadata(repo);
        const reviewerIds = reviewers.map(username => metadata.users.find((u: any) => u.username === username)?.id).filter(Boolean);
        return this.updatePR(repo, prNumber, { reviewer_ids: reviewerIds });
    }

    async updateAssigneesAndLabels(repo: string, prNumber: number, assignees: string[], labels: string[]): Promise<boolean> {
        const metadata = await this.fetchMetadata(repo);
        const assigneeIds = assignees.map(username => metadata.users.find((u: any) => u.username === username)?.id).filter(Boolean);
        return this.updatePR(repo, prNumber, { assignee_ids: assigneeIds, labels: labels.join(',') });
    }

    async fetchPRDetails(repo: string, prNumber: number): Promise<any> {
        const encodedRepo = encodeURIComponent(repo);
        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}`);
        return res.ok ? res.data : null;
    }

    async fetchBranches(repo: string): Promise<string[]> {
        const token = await this.getAccessToken();
        if (!token) return [];

        const encodedRepo = encodeURIComponent(repo);
        const res = await fetch(`https://gitlab.com/api/v4/projects/${encodedRepo}/repository/branches`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        if (!res.ok) return [];
        const data = await res.json();
        return data.map((b: any) => b.name);
    }

    async createPR(repo: string, data: any): Promise<any> {
        const encodedRepo = encodeURIComponent(repo);
        let title = data.title;

        if (data.isDraft && !title.startsWith('Draft:')) {
            title = `Draft: ${title}`;
        }

        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                description: data.description,
                source_branch: data.fromBranch,
                target_branch: data.toBranch
            })
        });

        if (!res.ok) throw new Error(res.data?.message || res.data?.error || 'Failed to create Merge Request');

        // Ensure to map it basically to expected struct if needed (id, number, html_url)
        return {
            ...res.data,
            number: res.data.iid,
            html_url: res.data.web_url
        };
    }
}

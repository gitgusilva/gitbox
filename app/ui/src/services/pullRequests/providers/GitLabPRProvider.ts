import { BasePRProvider } from './BasePRProvider';
import { PRReaction, PullRequest, PullRequestFile, PullRequestMetadata, ReactionTarget } from '../types';

/**
 * The UI speaks GitHub's reaction vocabulary; GitLab names its award emoji
 * differently, so translate in both directions at the provider boundary.
 */
const AWARD_BY_CONTENT: Record<string, string> = {
    '+1': 'thumbsup',
    '-1': 'thumbsdown',
    'laugh': 'laughing',
    'confused': 'confused',
    'heart': 'heart',
    'hooray': 'tada',
    'rocket': 'rocket',
    'eyes': 'eyes',
};

const CONTENT_BY_AWARD: Record<string, string> = Object.fromEntries(
    Object.entries(AWARD_BY_CONTENT).map(([content, award]) => [award, content]),
);

/** `https://gitlab.com/group/proj/-/merge_requests/7` -> `https://gitlab.com/group/proj`. */
function projectUrlFromMr(webUrl?: string) {
    if (!webUrl) return undefined;
    const cut = webUrl.indexOf('/-/merge_requests/');
    return cut === -1 ? undefined : webUrl.slice(0, cut);
}

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
            // GitLab's list payload has no project web URL; derive both ends
            // from the MR page, which is `<project>/-/merge_requests/<iid>`.
            sourceRepoUrl: projectUrlFromMr(mr.web_url),
            targetRepoUrl: projectUrlFromMr(mr.web_url),
            createdAt: mr.created_at,
            updatedAt: mr.updated_at,
            baseSha: mr.diff_refs?.base_sha,
            headSha: mr.diff_refs?.head_sha || mr.sha,
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
            url: '',
            kind: 'issue_comment'
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

    /** GitLab namespaces repository routes under `/-/`. */
    branchUrl(repoUrl: string | undefined, branch: string | undefined): string {
        if (!repoUrl || !branch) return '';
        return `${repoUrl}/-/tree/${branch.split('/').map(encodeURIComponent).join('/')}`;
    }

    normalizeDetails(raw: any): Partial<PullRequest> {
        if (!raw) return {};
        return {
            state: raw.state === 'opened' ? 'open' : raw.state,
            // `changes_count` arrives as a string, sometimes capped ("50+").
            changed_files: Number.parseInt(String(raw.changes_count ?? ''), 10) || undefined,
            mergeable: raw.merge_status === 'can_be_merged',
            baseSha: raw.diff_refs?.base_sha,
            headSha: raw.diff_refs?.head_sha || raw.sha,
            targetRepoUrl: projectUrlFromMr(raw.web_url),
            sourceRepoUrl: projectUrlFromMr(raw.web_url),
            updatedAt: raw.updated_at,
        };
    }

    async fetchFiles(repo: string, prNumber: number): Promise<PullRequestFile[]> {
        const encodedRepo = encodeURIComponent(repo);
        const res = await this._fetchJSON(`https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests/${prNumber}/changes`);
        if (!res.ok || !Array.isArray(res.data?.changes)) return [];

        return res.data.changes.map((c: any) => {
            // GitLab ships the unified diff but no line counters; count them
            // off the patch so the list can show the same +/- as GitHub.
            const lines = String(c.diff || '').split('\n');
            const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
            const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

            return {
                path: c.new_path || c.old_path,
                status: c.new_file ? 'added' : c.deleted_file ? 'removed' : c.renamed_file ? 'renamed' : 'modified',
                previousPath: c.renamed_file ? c.old_path : undefined,
                additions,
                deletions,
                binary: !c.diff,
            } as PullRequestFile;
        });
    }

    async fetchFileContent(repo: string, path: string, ref: string): Promise<string | null> {
        const encodedRepo = encodeURIComponent(repo);
        const res = await this._fetchJSON(
            `https://gitlab.com/api/v4/projects/${encodedRepo}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
        );
        if (!res.ok || !res.data?.content) return null;
        return String(res.data.content).replace(/\n/g, '');
    }

    /** Award emoji hang off the merge request, or off one of its notes. */
    private awardsPath(repo: string, target: ReactionTarget) {
        const encodedRepo = encodeURIComponent(repo);
        const base = `https://gitlab.com/api/v4/projects/${encodedRepo}/merge_requests/${target.prNumber}`;
        return target.kind === 'pr' ? `${base}/award_emoji` : `${base}/notes/${target.id}/award_emoji`;
    }

    async fetchReactions(repo: string, target: ReactionTarget, viewerLogin?: string | null): Promise<PRReaction[]> {
        const res = await this._fetchJSON(`${this.awardsPath(repo, target)}?per_page=100`);
        if (!res.ok || !Array.isArray(res.data)) return [];

        const grouped = new Map<string, PRReaction>();
        for (const award of res.data) {
            // Emoji with no GitHub counterpart keep their GitLab name; the UI
            // falls back to a generic icon rather than dropping the reaction.
            const content = CONTENT_BY_AWARD[award.name] || award.name;
            const entry: PRReaction = grouped.get(content) || { content, count: 0, users: [], viewerReactionId: null };
            entry.count += 1;
            if (award.user?.username) entry.users.push(award.user.username);
            if (viewerLogin && award.user?.username === viewerLogin) entry.viewerReactionId = award.id;
            grouped.set(content, entry);
        }
        return [...grouped.values()];
    }

    async addReaction(repo: string, target: ReactionTarget, content: string): Promise<boolean> {
        const name = AWARD_BY_CONTENT[content] || content;
        const res = await this._fetchJSON(`${this.awardsPath(repo, target)}?name=${encodeURIComponent(name)}`, { method: 'POST' });
        return res.ok;
    }

    async removeReaction(repo: string, target: ReactionTarget, reactionId: string | number): Promise<boolean> {
        const res = await this._fetchJSON(`${this.awardsPath(repo, target)}/${reactionId}`, { method: 'DELETE' });
        return res.ok || res.status === 204;
    }
}

import { IPRProvider } from './IPRProvider';
import { PRReaction, PullRequest, PullRequestFile, ReactionTarget } from '../types';

export abstract class BasePRProvider implements IPRProvider {
    constructor(protected getAccessToken: (force?: boolean) => Promise<string | undefined>) { }

    // Abstract methods mapped from IPRProvider
    abstract fetchPRs(repo: string, showClosed: boolean): Promise<any[]>;
    abstract closePR(repo: string, prNumber: number): Promise<boolean>;
    abstract convertToDraft(repo: string, prId: string): Promise<boolean>;
    abstract updatePR(repo: string, prNumber: number, data: any): Promise<boolean>;
    abstract submitReview(repo: string, prNumber: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body?: string): Promise<boolean>;
    abstract fetchComments(repo: string, prNumber: number): Promise<any[]>;
    abstract addComment(repo: string, prNumber: number, body: string): Promise<boolean>;
    abstract fetchMetadata(repo: string): Promise<any>;
    abstract fetchBranches(repo: string): Promise<string[]>;
    abstract createPR(repo: string, data: any): Promise<any>;
    abstract updateReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<boolean>;
    abstract updateAssigneesAndLabels(repo: string, prNumber: number, assignees: string[], labels: string[]): Promise<boolean>;
    abstract fetchPRDetails(repo: string, prNumber: number): Promise<any>;

    normalizeDetails(_raw: any): Partial<PullRequest> {
        return {};
    }

    /** `/tree/<branch>`, the layout most forges use; GitLab overrides it. */
    branchUrl(repoUrl: string | undefined, branch: string | undefined): string {
        if (!repoUrl || !branch) return '';
        return `${repoUrl}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`;
    }

    // Optional capabilities. A provider that cannot serve them keeps the PR
    // view working (empty file list, no reaction picker) instead of throwing.
    async fetchFiles(_repo: string, _prNumber: number): Promise<PullRequestFile[]> {
        return [];
    }

    async fetchFileContent(_repo: string, _path: string, _ref: string): Promise<string | null> {
        return null;
    }

    async fetchReactions(_repo: string, _target: ReactionTarget, _viewerLogin?: string | null): Promise<PRReaction[]> {
        return [];
    }

    async addReaction(_repo: string, _target: ReactionTarget, _content: string): Promise<boolean> {
        return false;
    }

    async removeReaction(_repo: string, _target: ReactionTarget, _reactionId: string | number): Promise<boolean> {
        return false;
    }

    protected async _fetchJSON(url: string, options: RequestInit = {}, isRetry = false): Promise<{ ok: boolean, status: number, data: any }> {
        const token = await this.getAccessToken(isRetry); // Pass isRetry as force flag
        if (!token) return { ok: false, status: 401, data: null };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            ...(options.headers || {})
        };

        const res = await fetch(url, { ...options, headers });

        // If 401 and we haven't retried yet, force a refresh and try again
        if (res.status === 401 && !isRetry) {
            return this._fetchJSON(url, options, true);
        }

        if (!res.ok) {
            let errorData = null;
            try {
                errorData = await res.json();
            } catch (e) {
                // Ignore parsing errors for non-JSON error bodies
            }

            return { ok: false, status: res.status, data: errorData };
        }

        // A 204 (DELETE a reaction, for one) carries no body, and parsing it as
        // JSON throws — report the success with a null payload instead.
        if (res.status === 204) return { ok: true, status: res.status, data: null };

        let data: any = null;
        try {
            data = await res.json();
        } catch {
            data = null;
        }

        return { ok: true, status: res.status, data };
    }
}

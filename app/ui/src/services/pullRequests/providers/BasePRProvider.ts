import { IPRProvider } from './IPRProvider';

export abstract class BasePRProvider implements IPRProvider {
    constructor(protected getAccessToken: (force?: boolean) => Promise<string | undefined>) { }

    // Abstract methods mapped from IPRProvider
    abstract fetchPRs(repo: string, showClosed: boolean): Promise<any[]>;
    abstract closePR(repo: string, prNumber: number): Promise<boolean>;
    abstract convertToDraft(repo: string, prId: string): Promise<boolean>;
    abstract updatePR(repo: string, prNumber: number, data: any): Promise<boolean>;
    abstract fetchComments(repo: string, prNumber: number): Promise<any[]>;
    abstract addComment(repo: string, prNumber: number, body: string): Promise<boolean>;
    abstract fetchMetadata(repo: string): Promise<any>;
    abstract fetchBranches(repo: string): Promise<string[]>;
    abstract createPR(repo: string, data: any): Promise<any>;
    abstract updateReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<boolean>;
    abstract updateAssigneesAndLabels(repo: string, prNumber: number, assignees: string[], labels: string[]): Promise<boolean>;
    abstract fetchPRDetails(repo: string, prNumber: number): Promise<any>;

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

        return { ok: true, status: 200, data: await res.json() };
    }
}

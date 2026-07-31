import { PRReaction, PullRequest, PullRequestFile, PullRequestMetadata, ReactionTarget } from '../types';

export interface IPRProvider {
    fetchPRs(repo: string, showClosed: boolean): Promise<PullRequest[]>;
    closePR(repo: string, prNumber: number): Promise<boolean>;
    convertToDraft(repo: string, prId: string): Promise<boolean>;
    updatePR(repo: string, prNumber: number, data: any): Promise<boolean>;
    submitReview(repo: string, prNumber: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body?: string): Promise<boolean>;
    fetchComments(repo: string, prNumber: number): Promise<any[]>;
    addComment(repo: string, prNumber: number, body: string): Promise<boolean>;
    fetchMetadata(repo: string): Promise<PullRequestMetadata>;
    fetchBranches(repo: string): Promise<string[]>;
    createPR(repo: string, data: any): Promise<any>;
    updateReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<boolean>;
    updateAssigneesAndLabels(repo: string, prNumber: number, assignees: string[], labels: string[]): Promise<boolean>;
    fetchPRDetails(repo: string, prNumber: number): Promise<any>;
    /**
     * Pulls the fields the PR view needs out of a provider's raw detail
     * payload. Kept separate from fetchPRDetails because callers inside the
     * provider still work with the raw shape.
     */
    normalizeDetails(raw: any): Partial<PullRequest>;

    /**
     * Web URL for a branch inside a repository of this forge. The grammar
     * differs per forge (GitHub `/tree/`, GitLab `/-/tree/`), so it belongs
     * with the provider that already knows which one this is.
     */
    branchUrl(repoUrl: string | undefined, branch: string | undefined): string;

    /** Files touched by the pull request, with their per-file line counts. */
    fetchFiles(repo: string, prNumber: number): Promise<PullRequestFile[]>;
    /**
     * A file's contents at a given commit, **base64 encoded**, or null when it
     * does not exist there (added/deleted files) or is too large to inline.
     *
     * Base64 rather than text because the same call serves images, which the
     * viewer turns straight into a data URL; callers rendering text decode it.
     */
    fetchFileContent(repo: string, path: string, ref: string): Promise<string | null>;

    /** Reactions grouped by emoji, including who reacted. */
    fetchReactions(repo: string, target: ReactionTarget, viewerLogin?: string | null): Promise<PRReaction[]>;
    addReaction(repo: string, target: ReactionTarget, content: string): Promise<boolean>;
    removeReaction(repo: string, target: ReactionTarget, reactionId: string | number): Promise<boolean>;
}

export interface PullRequest {
    id: string | number;
    number: number;
    title: string;
    body?: string;
    url: string;
    /** Normalized across providers: 'open' | 'closed' | 'merged'. */
    state: string;
    user: {
        login: string;
        avatar_url: string;
    };
    assignees?: { login: string; avatar_url: string }[];
    requestedReviewers?: { login: string; avatar_url: string }[];
    labels?: { name: string; color: string }[];
    sourceBranch: string;
    targetBranch: string;
    /** Web URL of the repository holding the source branch (a fork, for fork PRs). */
    sourceRepoUrl?: string;
    /** Web URL of the repository the PR targets. */
    targetRepoUrl?: string;
    /** Branch pages on the forge, built by the provider that owns the grammar. */
    sourceBranchUrl?: string;
    targetBranchUrl?: string;
    createdAt: string;
    updatedAt?: string;
    changed_files?: number;
    additions?: number;
    deletions?: number;
    commits?: number;
    /** Provider's merge check: true / false / null when still being computed. */
    mergeable?: boolean | null;
    /** Commit the diff is computed against, and the tip of the source branch. */
    baseSha?: string;
    headSha?: string;
    draft: boolean;
    nodeId: string;
    reactions?: any;
}

export interface PullRequestMetadata {
    users: any[];
    labels: any[];
}

/** One entry of a pull request's changed-file list. */
export interface PullRequestFile {
    path: string;
    /** Normalized across providers. */
    status: 'added' | 'removed' | 'modified' | 'renamed';
    previousPath?: string;
    additions: number;
    deletions: number;
    /** True for files the provider will not hand us a diff for (binaries). */
    binary?: boolean;
}

/**
 * What a reaction is attached to. `prNumber` is carried even for comments
 * because GitLab's award-emoji endpoints are nested under the merge request.
 */
export interface ReactionTarget {
    kind: 'pr' | 'issue_comment' | 'review_comment';
    /** PR/MR number for `pr`, comment id otherwise. */
    id: string | number;
    prNumber: number;
}

/**
 * Reactions grouped by emoji, using GitHub's content names ('+1', 'heart', …)
 * as the canonical vocabulary; other providers translate to and from it.
 */
export interface PRReaction {
    content: string;
    count: number;
    /** Logins of everyone who reacted, for the tooltip. */
    users: string[];
    /** Set when the signed-in user reacted — the id needed to undo it. */
    viewerReactionId?: string | number | null;
}

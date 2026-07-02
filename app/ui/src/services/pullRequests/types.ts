export interface PullRequest {
    id: string | number;
    number: number;
    title: string;
    body?: string;
    url: string;
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
    createdAt: string;
    changed_files?: number;
    draft: boolean;
    nodeId: string;
    reactions?: any;
}

export interface PullRequestMetadata {
    users: any[];
    labels: any[];
}

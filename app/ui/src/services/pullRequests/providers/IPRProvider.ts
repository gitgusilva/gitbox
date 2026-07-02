import { PullRequest, PullRequestMetadata } from '../types';

export interface IPRProvider {
    fetchPRs(repo: string, showClosed: boolean): Promise<PullRequest[]>;
    closePR(repo: string, prNumber: number): Promise<boolean>;
    convertToDraft(repo: string, prId: string): Promise<boolean>;
    updatePR(repo: string, prNumber: number, data: any): Promise<boolean>;
    fetchComments(repo: string, prNumber: number): Promise<any[]>;
    addComment(repo: string, prNumber: number, body: string): Promise<boolean>;
    fetchMetadata(repo: string): Promise<PullRequestMetadata>;
    fetchBranches(repo: string): Promise<string[]>;
    createPR(repo: string, data: any): Promise<any>;
    updateReviewers(repo: string, prNumber: number, reviewers: string[]): Promise<boolean>;
    updateAssigneesAndLabels(repo: string, prNumber: number, assignees: string[], labels: string[]): Promise<boolean>;
    fetchPRDetails(repo: string, prNumber: number): Promise<any>;
}

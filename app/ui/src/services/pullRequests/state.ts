/**
 * One source of truth for how a pull request's state is presented — the badge
 * in the PR view, the row in the sidebar, and anything added later all read
 * from here, so a merged PR never looks like a closed one in one place and not
 * the other.
 */
export type PullRequestStateKey = 'open' | 'draft' | 'merged' | 'closed';

/**
 * Providers disagree on how they report this: GitHub calls a merged PR
 * 'closed' and only sets `merged_at`, so the provider normalizes to 'merged'
 * before this ever runs. Draft is a flag, not a state.
 */
export function pullRequestStateKey(state?: string, draft?: boolean): PullRequestStateKey {
    if (state === 'merged') return 'merged';
    if (state === 'closed') return 'closed';
    return draft ? 'draft' : 'open';
}

export const PR_STATE_ICON: Record<PullRequestStateKey, string> = {
    open: 'lucide:git-pull-request',
    draft: 'lucide:file-pen-line',
    merged: 'lucide:git-merge',
    closed: 'lucide:git-pull-request-closed',
};

/** Foreground-only tone, for tight rows that cannot fit a filled pill. */
export const PR_STATE_TEXT_CLASS: Record<PullRequestStateKey, string> = {
    open: 'text-added',
    draft: 'text-content-muted',
    merged: 'text-accent',
    closed: 'text-removed',
};

/** Filled pill, for the badge. */
export const PR_STATE_BADGE_CLASS: Record<PullRequestStateKey, string> = {
    open: 'bg-added/30 text-added ring-added/50',
    draft: 'bg-surface-hover text-content-muted ring-line-strong',
    merged: 'bg-accent/25 text-accent ring-accent/50',
    closed: 'bg-removed/30 text-removed ring-removed/50',
};

/** i18n key holding the translated label. */
export function pullRequestStateLabelKey(key: PullRequestStateKey) {
    return `pr_view.state_${key}`;
}

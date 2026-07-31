import { describe, it, expect } from 'vitest';
import { PR_STATE_ICON, pullRequestStateKey, pullRequestStateLabelKey } from '../pullRequests/state';

describe('pullRequestStateKey', () => {
    it('separates merged from closed', () => {
        expect(pullRequestStateKey('merged')).toBe('merged');
        expect(pullRequestStateKey('closed')).toBe('closed');
    });

    it('treats draft as a flag on an open PR', () => {
        expect(pullRequestStateKey('open', true)).toBe('draft');
        expect(pullRequestStateKey('open', false)).toBe('open');
    });

    it('never calls a closed PR a draft', () => {
        // GitHub keeps `draft: true` on a PR that was closed while still a draft.
        expect(pullRequestStateKey('closed', true)).toBe('closed');
        expect(pullRequestStateKey('merged', true)).toBe('merged');
    });

    it('defaults to open for a missing state', () => {
        expect(pullRequestStateKey(undefined)).toBe('open');
    });

    it('has an icon and a label key for every state', () => {
        for (const key of ['open', 'draft', 'merged', 'closed'] as const) {
            expect(PR_STATE_ICON[key]).toBeTruthy();
            expect(pullRequestStateLabelKey(key)).toBe(`pr_view.state_${key}`);
        }
    });
});

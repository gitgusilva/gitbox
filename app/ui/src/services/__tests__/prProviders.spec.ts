import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubPRProvider } from '../pullRequests/providers/GitHubPRProvider';
import { GitLabPRProvider } from '../pullRequests/providers/GitLabPRProvider';

const token = async () => 'token';

/** Serves canned responses and records what was requested. */
function mockFetch(routes: Array<{ match: RegExp; status?: number; body?: any }>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        const route = routes.find(r => r.match.test(url));
        const status = route?.status ?? (route ? 200 : 404);
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => {
                if (route?.body === undefined) throw new SyntaxError('Unexpected end of JSON input');
                return route.body;
            },
        } as any;
    });
    vi.stubGlobal('fetch', fetchMock);
    return calls;
}

beforeEach(() => {
    vi.unstubAllGlobals();
});

describe('GitHubPRProvider', () => {
    it('reports a merged pull request as merged, not closed', async () => {
        mockFetch([{
            match: /\/pulls\?/, body: [
                { id: 1, number: 7, title: 'A', user: { login: 'x', avatar_url: '' }, state: 'closed', merged_at: '2026-07-30T00:00:00Z', head: { ref: 'feat', sha: 'h', repo: { html_url: 'https://github.com/fork/repo' } }, base: { ref: 'main', sha: 'b', repo: { html_url: 'https://github.com/up/repo' } } },
                { id: 2, number: 8, title: 'B', user: { login: 'x', avatar_url: '' }, state: 'closed', merged_at: null, head: { ref: 'fix', sha: 'h2', repo: { html_url: 'https://github.com/up/repo' } }, base: { ref: 'main', sha: 'b2', repo: { html_url: 'https://github.com/up/repo' } } },
            ]
        }]);

        const prs = await new GitHubPRProvider(token).fetchPRs('up/repo', true);

        expect(prs[0].state).toBe('merged');
        expect(prs[1].state).toBe('closed');
        // Fork PRs must link the branch in the fork, not in the target repo.
        expect(prs[0].sourceRepoUrl).toBe('https://github.com/fork/repo');
        expect(prs[0].targetRepoUrl).toBe('https://github.com/up/repo');
        expect(prs[0].baseSha).toBe('b');
        expect(prs[0].headSha).toBe('h');
    });

    it('falls back to the target repo when the fork is gone', async () => {
        mockFetch([{
            match: /\/pulls\?/, body: [
                { id: 1, number: 7, title: 'A', user: { login: 'x', avatar_url: '' }, state: 'open', head: { ref: 'feat', repo: null }, base: { ref: 'main', repo: { html_url: 'https://github.com/up/repo' } } },
            ]
        }]);

        const [pr] = await new GitHubPRProvider(token).fetchPRs('up/repo', false);
        expect(pr.sourceRepoUrl).toBe('https://github.com/up/repo');
    });

    it('normalizes the changed-file list', async () => {
        mockFetch([{
            match: /\/pulls\/7\/files/, body: [
                { filename: 'a.ts', status: 'modified', additions: 3, deletions: 1, patch: '@@' },
                { filename: 'b.png', status: 'added', additions: 0, deletions: 0 },
                { filename: 'c.ts', status: 'renamed', previous_filename: 'old.ts', additions: 0, deletions: 0, patch: '@@' },
            ]
        }]);

        const files = await new GitHubPRProvider(token).fetchFiles('up/repo', 7);
        expect(files.map(f => f.status)).toEqual(['modified', 'added', 'renamed']);
        expect(files[2].previousPath).toBe('old.ts');
        expect(files[0].additions).toBe(3);
    });

    it('groups reactions and finds the viewer own reaction', async () => {
        mockFetch([{
            match: /\/issues\/7\/reactions/, body: [
                { id: 11, content: '+1', user: { login: 'ana' } },
                { id: 12, content: '+1', user: { login: 'me' } },
                { id: 13, content: 'rocket', user: { login: 'ana' } },
            ]
        }]);

        const reactions = await new GitHubPRProvider(token).fetchReactions('up/repo', { kind: 'pr', id: 7, prNumber: 7 }, 'me');

        const thumbs = reactions.find(r => r.content === '+1')!;
        expect(thumbs.count).toBe(2);
        expect(thumbs.users).toEqual(['ana', 'me']);
        expect(thumbs.viewerReactionId).toBe(12);
        expect(reactions.find(r => r.content === 'rocket')!.viewerReactionId).toBeNull();
    });

    it('targets the right endpoint per reaction kind', async () => {
        const calls = mockFetch([{ match: /reactions/, body: [] }]);
        const provider = new GitHubPRProvider(token);

        await provider.fetchReactions('up/repo', { kind: 'issue_comment', id: 99, prNumber: 7 });
        await provider.fetchReactions('up/repo', { kind: 'review_comment', id: 98, prNumber: 7 });

        expect(calls[0].url).toContain('/issues/comments/99/reactions');
        expect(calls[1].url).toContain('/pulls/comments/98/reactions');
    });

    it('treats an empty 204 body as a successful delete', async () => {
        // No `body` on the route: json() throws, exactly like a real 204.
        mockFetch([{ match: /reactions\/11/, status: 204 }]);

        const ok = await new GitHubPRProvider(token).removeReaction('up/repo', { kind: 'pr', id: 7, prNumber: 7 }, 11);
        expect(ok).toBe(true);
    });
});

describe('GitLabPRProvider', () => {
    it('translates award emoji to the shared reaction vocabulary', async () => {
        mockFetch([{
            match: /award_emoji/, body: [
                { id: 1, name: 'thumbsup', user: { username: 'ana' } },
                { id: 2, name: 'tada', user: { username: 'me' } },
            ]
        }]);

        const reactions = await new GitLabPRProvider(token).fetchReactions('g/p', { kind: 'pr', id: 7, prNumber: 7 }, 'me');
        expect(reactions.map(r => r.content).sort()).toEqual(['+1', 'hooray']);
        expect(reactions.find(r => r.content === 'hooray')!.viewerReactionId).toBe(2);
    });

    it('translates back when adding a reaction', async () => {
        const calls = mockFetch([{ match: /award_emoji/, body: {} }]);

        await new GitLabPRProvider(token).addReaction('g/p', { kind: 'pr', id: 7, prNumber: 7 }, '+1');
        expect(calls[0].url).toContain('name=thumbsup');
        expect(calls[0].init.method).toBe('POST');
    });

    it('nests note reactions under the merge request', async () => {
        const calls = mockFetch([{ match: /award_emoji/, body: [] }]);

        await new GitLabPRProvider(token).fetchReactions('g/p', { kind: 'issue_comment', id: 55, prNumber: 7 });
        expect(calls[0].url).toContain('/merge_requests/7/notes/55/award_emoji');
    });

    it('counts additions and deletions off the diff', async () => {
        mockFetch([{
            match: /\/changes/, body: {
                changes: [
                    { new_path: 'a.ts', old_path: 'a.ts', diff: '--- a\n+++ b\n+added\n+added\n-gone\n context' },
                    { new_path: 'b.ts', old_path: 'b.ts', new_file: true, diff: '+++ b\n+one' },
                ]
            }
        }]);

        const files = await new GitLabPRProvider(token).fetchFiles('g/p', 7);
        // The +++/--- file headers must not be counted as changed lines.
        expect(files[0]).toMatchObject({ path: 'a.ts', status: 'modified', additions: 2, deletions: 1 });
        expect(files[1]).toMatchObject({ path: 'b.ts', status: 'added', additions: 1, deletions: 0 });
    });

    it('derives the project URL from the merge request page', async () => {
        mockFetch([{
            match: /merge_requests\?/, body: [
                { id: 1, iid: 7, title: 'A', author: { username: 'x', avatar_url: '' }, state: 'opened', web_url: 'https://gitlab.com/group/proj/-/merge_requests/7', source_branch: 'feat', target_branch: 'main' },
            ]
        }]);

        const [mr] = await new GitLabPRProvider(token).fetchPRs('group/proj', false);
        expect(mr.state).toBe('open');
        expect(mr.targetRepoUrl).toBe('https://gitlab.com/group/proj');
    });
});

describe('branch links', () => {
    it('uses the forge URL grammar of each provider', () => {
        const github = new GitHubPRProvider(token);
        const gitlab = new GitLabPRProvider(token);

        expect(github.branchUrl('https://github.com/o/r', 'feat/x')).toBe('https://github.com/o/r/tree/feat/x');
        // GitLab namespaces repository routes under /-/.
        expect(gitlab.branchUrl('https://gitlab.com/g/p', 'feat/x')).toBe('https://gitlab.com/g/p/-/tree/feat/x');
    });

    it('escapes each path segment but keeps the slashes', () => {
        const github = new GitHubPRProvider(token);
        expect(github.branchUrl('https://github.com/o/r', 'feat/a b')).toBe('https://github.com/o/r/tree/feat/a%20b');
    });

    it('has no link without a repository or a branch', () => {
        const github = new GitHubPRProvider(token);
        expect(github.branchUrl(undefined, 'main')).toBe('');
        expect(github.branchUrl('https://github.com/o/r', undefined)).toBe('');
    });
});

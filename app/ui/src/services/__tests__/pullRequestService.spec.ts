import { describe, it, expect, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { pullRequests, visiblePullRequests } from '../pullRequestService';
import { generalSettings } from '../settingsService';

function pr(number: number, state: string) {
    return {
        id: number,
        number,
        title: `PR ${number}`,
        url: '',
        state,
        user: { login: 'someone', avatar_url: '' },
        sourceBranch: 'feat/x',
        targetBranch: 'main',
        createdAt: '',
        draft: false,
        nodeId: '',
    } as any;
}

describe('visiblePullRequests', () => {
    beforeEach(() => {
        pullRequests.value = [pr(1, 'open'), pr(2, 'closed'), pr(3, 'merged')];
        generalSettings.value.showClosedPRs = false;
    });

    it('hides everything that is no longer open', () => {
        expect(visiblePullRequests.value.map(p => p.number)).toEqual([1]);
    });

    it('keeps closed ones when the setting is on', () => {
        generalSettings.value.showClosedPRs = true;
        expect(visiblePullRequests.value.map(p => p.number)).toEqual([1, 2, 3]);
    });

    it('reacts to the setting without waiting for a refetch', async () => {
        expect(visiblePullRequests.value.length).toBe(1);

        generalSettings.value.showClosedPRs = true;
        await nextTick();
        expect(visiblePullRequests.value.length).toBe(3);

        generalSettings.value.showClosedPRs = false;
        await nextTick();
        expect(visiblePullRequests.value.length).toBe(1);
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const fetchReactions = vi.fn();
const toggleReaction = vi.fn();

vi.mock('../../../services/pullRequestService', () => ({
    fetchReactions: (...args: any[]) => fetchReactions(...args),
    toggleReaction: (...args: any[]) => toggleReaction(...args),
}));

import ReactionBar from '../ReactionBar.vue';

const TARGET = { kind: 'pr' as const, id: 7, prNumber: 7 };

function mountBar(props: Record<string, unknown> = {}) {
    return mount(ReactionBar, {
        props: { target: TARGET, canReact: true, ...props },
        global: { stubs: { Icon: true, Tooltip: { template: '<div><slot /></div>' } } },
    });
}

beforeEach(() => {
    fetchReactions.mockReset().mockResolvedValue([]);
    toggleReaction.mockReset().mockResolvedValue(true);
});

describe('ReactionBar', () => {
    it('renders the inline counts without hitting the network', () => {
        const w = mountBar({ initial: { '+1': 2, rocket: 1, '-1': 0, total_count: 3, url: 'x' } });

        // Only the two non-zero emoji, plus the picker button.
        expect(w.findAll('button').length).toBe(3);
        expect(w.text()).toContain('2');
        expect(fetchReactions).not.toHaveBeenCalled();
    });

    it('loads who reacted when the bar is hovered', async () => {
        fetchReactions.mockResolvedValue([{ content: '+1', count: 2, users: ['ana', 'me'], viewerReactionId: 12 }]);
        const w = mountBar({ initial: { '+1': 2, total_count: 2 } });

        await w.trigger('mouseenter');
        await flushPromises();

        expect(fetchReactions).toHaveBeenCalledTimes(1);
        // A second hover reuses what was already fetched.
        await w.trigger('mouseenter');
        expect(fetchReactions).toHaveBeenCalledTimes(1);
    });

    it('removes the viewer own reaction instead of adding a duplicate', async () => {
        fetchReactions.mockResolvedValue([{ content: '+1', count: 1, users: ['me'], viewerReactionId: 12 }]);
        const w = mountBar({ initial: { '+1': 1, total_count: 1 } });

        await w.findAll('button')[0].trigger('click');
        await flushPromises();

        expect(toggleReaction).toHaveBeenCalledWith(TARGET, '+1', 12);
    });

    it('adds a reaction the viewer has not used yet', async () => {
        fetchReactions.mockResolvedValue([{ content: '+1', count: 1, users: ['ana'], viewerReactionId: null }]);
        const w = mountBar({ initial: { '+1': 1, total_count: 1 } });

        await w.findAll('button')[0].trigger('click');
        await flushPromises();

        expect(toggleReaction).toHaveBeenCalledWith(TARGET, '+1', null);
    });

    it('hides the picker and blocks toggling when nobody is signed in', async () => {
        const w = mountBar({ canReact: false, initial: { '+1': 1, total_count: 1 } });

        expect(w.findAll('button').length).toBe(1); // the chip only, no picker
        await w.findAll('button')[0].trigger('click');
        await flushPromises();
        expect(toggleReaction).not.toHaveBeenCalled();
    });

    it('offers the full emoji set in the picker', async () => {
        const w = mountBar({ initial: null });

        await w.findAll('button')[0].trigger('click');
        // picker button + the eight emoji
        expect(w.findAll('button').length).toBe(9);
    });
});

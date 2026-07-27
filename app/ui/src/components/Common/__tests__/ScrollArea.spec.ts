import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { h } from 'vue';
import ScrollArea from '../ScrollArea.vue';

/**
 * SimpleBar scrolls an inner wrapper, not the element ScrollArea renders — so
 * scrollToTop has to reach the instance's `scrollElement`. If a SimpleBar
 * upgrade renames that, the method silently becomes a no-op and callers (the
 * Settings modal swapping sections) quietly go back to keeping the old offset.
 */
describe('ScrollArea.scrollToTop', () => {
    it('resets the scrolled element, not the root', async () => {
        const w = mount(ScrollArea, {
            slots: { default: () => h('div', { style: 'height: 5000px' }, 'tall') },
        });

        const inner = (w.vm as any).$refs?.bar?.scrollElement as HTMLElement | undefined;
        expect(inner, 'simplebar no longer exposes scrollElement').toBeTruthy();

        inner!.scrollTop = 400;
        (w.vm as unknown as { scrollToTop: () => void }).scrollToTop();
        expect(inner!.scrollTop).toBe(0);

        w.unmount();
    });

    it('does not throw before the scroller exists', () => {
        const w = mount(ScrollArea);
        expect(() => (w.vm as unknown as { scrollToTop: () => void }).scrollToTop()).not.toThrow();
        w.unmount();
    });
});

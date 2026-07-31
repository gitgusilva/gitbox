import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ImageDiffViewer from '../ImageDiffViewer.vue';

// 1x1 transparent PNG, enough to exercise the data-URL and byte-size paths.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const IconButtonStub = {
    props: ['label', 'icon', 'active'],
    template: '<button :data-label="label" :data-active="active ? \'1\' : \'0\'"></button>',
};

function mountViewer(props: Record<string, unknown>) {
    return mount(ImageDiffViewer, {
        props: { filename: 'preview@2x.png', ...props } as any,
        global: { stubs: { IconButton: IconButtonStub, Icon: true } },
    });
}

/** Pretend the browser decoded the image, then fire the load event. */
async function fakeLoad(wrapper: any, index: number, w: number, h: number) {
    const el = wrapper.findAll('img')[index].element as HTMLImageElement;
    Object.defineProperty(el, 'naturalWidth', { value: w, configurable: true });
    Object.defineProperty(el, 'naturalHeight', { value: h, configurable: true });
    Object.defineProperty(el, 'clientWidth', { value: w / 4, configurable: true });
    await wrapper.findAll('img')[index].trigger('load');
}

describe('ImageDiffViewer', () => {
    it('fits images to the pane by default instead of rendering them at natural size', () => {
        const w = mountViewer({ original: PNG, modified: PNG });
        const imgs = w.findAll('img');

        expect(imgs.length).toBe(2);
        for (const img of imgs) {
            expect(img.classes()).toContain('object-contain');
            expect(img.classes()).toContain('max-w-full');
            expect(img.classes()).toContain('max-h-full');
            // Fit mode must not pin a pixel size — that is what cropped the
            // image inside the pane.
            expect(img.attributes('style')).toBeUndefined();
        }
    });

    it('renders at the natural pixel size once actual-size is picked', async () => {
        const w = mountViewer({ original: PNG, modified: PNG });
        await fakeLoad(w, 0, 1440, 920);
        await fakeLoad(w, 1, 1440, 920);

        const actual = w.findAll('button').find(b => b.attributes('data-label') === 'diff.zoom_actual')!;
        await actual.trigger('click');

        const style = w.findAll('img')[0].attributes('style') || '';
        expect(style).toContain('width: 1440px');
        expect(style).toContain('height: 920px');
        expect(style).toContain('max-width: none');
    });

    it('reports the fit scale as a percentage', async () => {
        const w = mountViewer({ original: PNG, modified: PNG });
        await fakeLoad(w, 1, 1440, 920); // rendered at a quarter of its width
        expect(w.text()).toContain('25%');
    });

    it('shows dimensions and weight for each side', async () => {
        const w = mountViewer({ original: PNG, modified: PNG });
        await fakeLoad(w, 0, 1440, 920);
        expect(w.text()).toContain('1440 × 920');
        expect(w.text()).toMatch(/\d+ B/);
    });

    it('falls back to a placeholder for a side that does not exist', () => {
        const added = mountViewer({ original: '', modified: PNG });
        expect(added.findAll('img').length).toBe(1);
        expect(added.text()).toContain('common.file_not_in_parent');

        const deleted = mountViewer({ original: PNG, modified: '' });
        expect(deleted.findAll('img').length).toBe(1);
        expect(deleted.text()).toContain('common.file_deleted');
    });

    it('resets the zoom when another file is opened', async () => {
        const w = mountViewer({ original: PNG, modified: PNG });
        await fakeLoad(w, 0, 1440, 920);

        const actual = w.findAll('button').find(b => b.attributes('data-label') === 'diff.zoom_actual')!;
        await actual.trigger('click');
        expect(w.findAll('img')[0].attributes('style')).toContain('width: 1440px');

        await w.setProps({ filename: 'other.png' });
        expect(w.findAll('img')[0].attributes('style')).toBeUndefined();
    });
});

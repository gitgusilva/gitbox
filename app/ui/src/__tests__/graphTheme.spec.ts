import { describe, it, expect, beforeEach } from 'vitest';
import { appendCommitGraph, createGraphState } from '../GraphBuilder';
import { BUILTIN_THEMES } from '../services/themes/builtins';
import { Commit, GraphNode } from '../types/git';
import { ThemeColors } from '../types/theme';

/**
 * The lane palette is read from the theme's CSS vars while the nodes are built,
 * so each node carries a literal `rgb(...)`. These tests pin that link: a theme
 * change must be visible in the colours a rebuild produces — otherwise the graph
 * keeps the palette of whatever theme was active when the log first loaded.
 */

function commit(id: string, parents: string[] = []): Commit {
    return {
        id,
        author: 'a',
        summary: id,
        timestamp: 0,
        parents: parents.map(p => ({ id: p, summary: p, author: 'a', timestamp: 0 })),
    };
}

function setPalette(channels: string[]) {
    channels.forEach((c, i) => document.documentElement.style.setProperty(`--gb-graph-${i + 1}`, c));
}

function build(commits: Commit[], headId: string | null): Map<string, GraphNode> {
    const map = new Map<string, GraphNode>();
    appendCommitGraph(map, createGraphState(), commits, headId, headId ? [headId] : null);
    return map;
}

// A linear chain plus a side branch, so more than one lane is coloured.
const LOG = [commit('c3', ['c2']), commit('side', ['c1']), commit('c2', ['c1']), commit('c1')];

describe('commit graph palette follows the theme', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('style');
    });

    it('resolves lane colours from the --gb-graph-* channel triplets', () => {
        setPalette(['10 20 30', '40 50 60', '70 80 90', '1 1 1', '2 2 2', '3 3 3', '4 4 4', '5 5 5']);

        const map = build(LOG, 'c3');

        expect(map.get('c3')!.color).toBe('rgb(10 20 30)');
        // Every colour drawn must come from the palette we just installed —
        // nothing hardcoded leaks through.
        const palette = ['10 20 30', '40 50 60', '70 80 90', '1 1 1', '2 2 2', '3 3 3', '4 4 4', '5 5 5']
            .map(c => `rgb(${c})`);
        for (const node of map.values()) {
            if (!node.dimmed) expect(palette).toContain(node.color);
            node.lines.filter(l => !l.dimmed).forEach(l => expect(palette).toContain(l.color));
        }
    });

    it('produces the new colours after the palette changes', () => {
        setPalette(['10 20 30', '40 50 60', '70 80 90', '1 1 1', '2 2 2', '3 3 3', '4 4 4', '5 5 5']);
        const before = build(LOG, 'c3');

        setPalette(['200 0 0', '0 200 0', '0 0 200', '9 9 9', '8 8 8', '7 7 7', '6 6 6', '5 5 5']);
        const after = build(LOG, 'c3');

        expect(before.get('c3')!.color).toBe('rgb(10 20 30)');
        expect(after.get('c3')!.color).toBe('rgb(200 0 0)');
        // Same topology, so the lane assignment is untouched — only the colour moves.
        expect(after.get('c3')!.dotLane).toBe(before.get('c3')!.dotLane);
    });

    it('falls back to the built-in palette when the vars are absent', () => {
        const map = build(LOG, 'c3');
        expect(map.get('c3')!.color).toBe('#1E88E5');
    });
});

/**
 * The colours only follow the theme if the theme actually carries them. Omitting
 * them is silent — `applyGitboxTheme` merges DEFAULT_GRAPH_COLORS over the gap —
 * so every built-in looked identical in the graph while looking different
 * everywhere else. These tests are what makes a new theme fail loudly instead.
 */
describe('every built-in theme carries its own graph palette', () => {
    const LANE_KEYS = ([1, 2, 3, 4, 5, 6, 7, 8] as const).map(i => `graph${i}` as keyof ThemeColors);

    it.each(BUILTIN_THEMES.map(t => [t.name, t] as const))('%s defines all 8 lanes + marker', (_name, theme) => {
        LANE_KEYS.forEach(key => expect(theme.colors[key]).toMatch(/^#[0-9A-Fa-f]{6}$/));
        expect(theme.colors.graphMarker).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it.each(BUILTIN_THEMES.map(t => [t.name, t] as const))('%s keeps its 8 lanes distinguishable', (_name, theme) => {
        const lanes = LANE_KEYS.map(k => theme.colors[k]!.toUpperCase());
        expect(new Set(lanes).size).toBe(8);
    });

    it('gives the light and dark defaults different palettes', () => {
        const [dark, light] = [BUILTIN_THEMES[0], BUILTIN_THEMES[1]];
        expect(LANE_KEYS.map(k => dark.colors[k])).not.toEqual(LANE_KEYS.map(k => light.colors[k]));
    });

    it('gives a theme with no palette one that suits its background', async () => {
        // Community imports and forks made before themes carried a palette have no
        // graph colours at all. Falling back to one fixed set put lanes tuned for
        // #1E1E1E on a white background, so the fallback follows the theme type.
        const { graphFallback } = await import('../services/themeService');
        const [dark, light] = [graphFallback('dark'), graphFallback('light')];

        expect(dark.graph1).toBe(BUILTIN_THEMES[0].colors.graph1);
        expect(light.graph1).toBe(BUILTIN_THEMES[1].colors.graph1);
        expect(dark.graph1).not.toBe(light.graph1);
        // Nothing left undefined — every var the graph reads must resolve.
        LANE_KEYS.forEach(k => expect(light[k]).toMatch(/^#[0-9A-Fa-f]{6}$/));
        expect(light.graphMarker).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('carves the merge glyph in the theme background, matching the dot ring', () => {
        // CommitGraph draws the ring from --gb-bg; a marker of another colour
        // stops reading as a cut-out and was the last hardcoded white left.
        BUILTIN_THEMES.forEach(theme => {
            expect(theme.colors.graphMarker!.toUpperCase()).toBe(theme.colors.bg.toUpperCase());
        });
    });
});

import { describe, it, expect } from 'vitest';
import { appendCommitGraph, createGraphState } from '../GraphBuilder';
import { Commit, GraphLine, GraphNode } from '../types/git';

/**
 * Lines used to turn at a fixed mid-row height, which gave every converging
 * branch and every merge edge the SAME flat run along y = 14. Two of them on one
 * row were drawn on top of each other, so only the last one painted survived —
 * on a real repo a branch converging into a dot and the merge edge leaving it ran
 * within 1px of each other for 40px and the first looked cut in half.
 *
 * These tests pin the routing that replaced it: branches arriving at a dot are
 * quadratic arcs that nest above the row (one per source column), while merge
 * edges leaving it are pushed into their own band below it. The two families
 * therefore cannot share a stroke, and members of a family only meet where the
 * dot glyph covers them.
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

function build(commits: Commit[], headId: string | null = null): Map<string, GraphNode> {
    const map = new Map<string, GraphNode>();
    appendCommitGraph(map, createGraphState(), commits, headId, headId ? [headId] : null);
    return map;
}

type Pt = { x: number; y: number };

/** Samples the `M … L|Q|C …` paths GraphBuilder emits. */
function samplePath(d: string, per = 60): Pt[] {
    const n = d.match(/-?[\d.]+/g)!.map(Number);
    const start = { x: n[0], y: n[1] };
    const rest = n.slice(2);
    const out: Pt[] = [start];
    const at = (t: number, pts: Pt[]) => {
        const k = pts.length - 1;               // 1 = line, 2 = quadratic, 3 = cubic
        const bin = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]][k];
        return pts.reduce((acc, p, i) => ({
            x: acc.x + bin[i] * (1 - t) ** (k - i) * t ** i * p.x,
            y: acc.y + bin[i] * (1 - t) ** (k - i) * t ** i * p.y,
        }), { x: 0, y: 0 });
    };
    const ctrl: Pt[] = [start];
    for (let i = 0; i < rest.length; i += 2) ctrl.push({ x: rest[i], y: rest[i + 1] });
    for (let i = 1; i <= per; i++) out.push(at(i / per, ctrl));
    return out;
}

const DOT_R = 6;
const MID = 14;

/** Longest run of one line that stays within `tol` of another, ignoring the dot. */
function longestFusedRun(lines: GraphLine[], dotX: number, tol = 1.6): number {
    const curves = lines.map(l => samplePath(l.path));
    let worst = 0;
    curves.forEach((pts, a) => {
        let run = 0;
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            if (Math.hypot(p.x - dotX, p.y - MID) < DOT_R) { run = 0; continue; }
            let near = Infinity;
            curves.forEach((other, b) => {
                if (b === a) return;
                for (const q of other) near = Math.min(near, Math.hypot(p.x - q.x, p.y - q.y));
            });
            if (near < tol) {
                run += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
                worst = Math.max(worst, run);
            } else {
                run = 0;
            }
        }
    });
    return worst;
}

describe('commit graph line routing', () => {
    it('nests branches converging on one dot as separate arcs', () => {
        // Six tips collapsing onto a single parent. They all end on the dot, so
        // they are only ever distinguishable ABOVE it — each has to keep its own
        // arc rather than flattening onto the row with the others.
        const map = build([
            commit('t1', ['base']), commit('t2', ['base']), commit('t3', ['base']),
            commit('t4', ['base']), commit('t5', ['base']), commit('t6', ['base']),
            commit('base'),
        ]);

        const base = map.get('base')!;
        const dotX = base.dotLane * 12 + 10;
        const arcs = base.lines.filter(l => l.path.includes('Q'));
        expect(arcs.length).toBe(5);
        expect(new Set(arcs.map(l => l.path)).size).toBe(arcs.length);

        // Halfway along, every arc sits at a distinct distance from the dot column:
        // that separation is what stops one being painted over another.
        const mids = arcs.map(l => samplePath(l.path)[30].x).sort((a, b) => a - b);
        for (let i = 1; i < mids.length; i++) expect(mids[i] - mids[i - 1]).toBeGreaterThan(3);
        // And none of them dips below the row the dot sits on.
        for (const l of arcs) for (const p of samplePath(l.path)) expect(p.y).toBeLessThanOrEqual(MID + 0.01);
        expect(dotX).toBeGreaterThan(0);
    });

    it('keeps a merge edge clear of the branches arriving at the same dot', () => {
        // The regression: a branch converging in and the merge edge leaving ran
        // within 1px of each other for 40px, so one painted straight over it.
        const map = build([
            commit('m', ['a', 'far']),
            commit('a', ['base']),
            commit('s1', ['base']),
            commit('s2', ['base']),
            commit('far', ['base']),
            commit('base'),
        ]);

        for (const node of map.values()) {
            const dotX = node.dotLane * 12 + 10;
            const leaving = node.lines.filter(l => l.path.startsWith(`M ${dotX} ${MID} C`));
            const arriving = node.lines.filter(l => l.path.includes('Q'));
            if (!leaving.length || !arriving.length) continue;
            expect(longestFusedRun([...leaving, ...arriving], dotX)).toBeLessThan(4);
        }
    });

    it('separates the two families across the dot row', () => {
        const map = build([
            commit('m', ['a', 'b']),
            commit('a', ['base']),
            commit('b', ['base']),
            commit('base'),
        ]);

        const merge = map.get('m')!;
        const dotX = merge.dotLane * 12 + 10;
        // The merge edge leaves the dot downwards and never rides back up along the
        // row, so anything arriving at the dot from above stays clear of it.
        const edge = merge.lines.find(l => l.path.startsWith(`M ${dotX} ${MID} C`));
        expect(edge).toBeDefined();
        for (const p of samplePath(edge!.path)) expect(p.y).toBeGreaterThanOrEqual(MID - 0.01);
    });

    it('never emits two identical paths on the same row', () => {
        const map = build([
            commit('m', ['a', 'b']),
            commit('a', ['c']),
            commit('b', ['c']),
            commit('c', ['d', 'e']),
            commit('d', ['base']),
            commit('e', ['base']),
            commit('base'),
        ]);

        for (const node of map.values()) {
            const paths = node.lines.map(l => l.path);
            expect(new Set(paths).size).toBe(paths.length);
        }
    });

    it('paints dimmed lanes before highlighted ones so crossings favour the ancestry', () => {
        // 'side' is not reachable from HEAD ('c3'), so its lane is dimmed.
        const map = build([
            commit('c3', ['c2']),
            commit('side', ['c1']),
            commit('c2', ['c1']),
            commit('c1'),
        ], 'c3');

        for (const node of map.values()) {
            const firstBright = node.lines.findIndex(l => !l.dimmed);
            if (firstBright === -1) continue;
            expect(node.lines.slice(firstBright).some(l => l.dimmed)).toBe(false);
        }
    });
});

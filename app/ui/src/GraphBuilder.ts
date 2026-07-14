import { Commit, GraphLine, GraphNode } from './types/git';

const FALLBACK_COLORS = [
    '#1E88E5', '#FFAB00', '#00E676', '#D500F9', '#FF3D00', '#00B0FF', '#1DE9B6', '#F50057'
];

/**
 * Reads the themeable commit-graph palette from CSS vars (--gb-graph-1..8),
 * resolving each "r g b" channel triplet into an `rgb()` string usable directly
 * as an SVG stroke/fill. Falls back to the built-in palette if unavailable.
 * Read per build so theme switches recolor the graph.
 */
function readPalette(): string[] {
    if (typeof document === 'undefined' || !document.documentElement) return FALLBACK_COLORS;
    const cs = getComputedStyle(document.documentElement);
    const out: string[] = [];
    for (let i = 1; i <= 8; i++) {
        const v = cs.getPropertyValue(`--gb-graph-${i}`).trim();
        out.push(v ? `rgb(${v})` : FALLBACK_COLORS[i - 1]);
    }
    return out;
}

/**
 * Carry-over lane state so history pages can be laid out incrementally. The
 * state at the end of one page is exactly the starting state of the next (older)
 * page, since commits stream in newest→oldest order.
 */
export interface GraphState {
    lanes: (string | null)[];
    // Stable color per lane: a lane keeps its color for as long as it stays
    // occupied by a continuous chain, so each branch keeps one color all the way
    // down (SourceGit-style) instead of recoloring by lane index.
    laneColors: string[];
    // Per-lane reachability of the EDGE currently descending in that lane, i.e.
    // whether the child commit that owns this lane's line is reachable from HEAD.
    // A line is on the current branch's history only if the child it flows *from*
    // is reachable — tying line colour to the destination dot instead paints a
    // colour onto an off-branch line whenever its parent is shared with HEAD.
    laneReach: boolean[];
    nextColor: number;
    // Commit ids reachable from HEAD, grown newest→oldest: when a reachable commit
    // is laid out its parents are added, so the whole current-branch ancestry gets
    // marked. Anything left unmarked is off-branch and drawn dim (SourceGit-style).
    reachable: Set<string>;
}

export function createGraphState(): GraphState {
    return { lanes: [], laneColors: [], laneReach: [], nextColor: 0, reachable: new Set() };
}

/**
 * Lays out `commits` (newest→oldest, continuing from `state`) into `map`,
 * mutating both. Each node depends only on the lane state *before* it — never on
 * its absolute position in the log — so appended pages cost O(Δ) instead of the
 * O(n) full rebuild that made infinite scroll O(n²).
 */
export function appendCommitGraph(map: Map<string, GraphNode>, state: GraphState, commits: Commit[], headId: string | null = null): void {
    if (!commits || commits.length === 0) return;

    const { lanes, laneColors, laneReach } = state;
    // Current-branch highlighting: only when we know HEAD. Seed HEAD as reachable;
    // reachability then flows to parents as reachable commits are laid out.
    const dimEnabled = !!headId;
    if (headId) state.reachable.add(headId);
    const reach = (id: string | null) => !dimEnabled || (id != null && state.reachable.has(id));
    const palette = readPalette();
    const allocColor = () => palette[state.nextColor++ % palette.length];
    const colorFor = (lane: number) => {
        if (!laneColors[lane]) laneColors[lane] = allocColor();
        return laneColors[lane];
    };

    // Each history row is 30px tall (ROW_HEIGHT in HistoryCommitList). The cell
    // spans the FULL row and overlaps its neighbours by ~1px on each end, else
    // consecutive rows' vertical lines leave a 1px gap that reads as a "cut" at
    // every row boundary. The per-row SVG uses overflow-visible, so drawing
    // slightly out of bounds is safe.
    const cellTop = -1;
    const cellH = 31;
    const midY = 14;
    const cornerR = 6; // rounded-corner radius where a line turns at the middle
    const laneW = 12;
    const offset = 10;
    const x = (l: number) => l * laneW + offset;

    for (const c of commits) {
        // Reachable-from-HEAD is settled by now (all children precede a commit in
        // topological order); propagate to parents so the ancestry keeps its color.
        const cReach = reach(c.id);
        if (dimEnabled && cReach && c.parents) for (const p of c.parents) state.reachable.add(p.id);

        const inLanes = [...lanes];
        // Snapshot lane colours BEFORE this row reassigns any (a merge can reuse a
        // just-freed lane for its 2nd parent, changing that lane's colour). Lines
        // coming from ABOVE must keep the colour the lane had above — otherwise a
        // branch converging into a merge suddenly repaints to the reused colour.
        const inColors = [...laneColors];
        // Snapshot edge reachability from ABOVE too: lines entering this row belong
        // to the child that set the lane, so their dimming must read the value the
        // lane had before this row reassigns it.
        const inReach = [...laneReach];
        let dotLane = -1;
        for (let j = 0; j < inLanes.length; j++) {
            if (inLanes[j] === c.id) {
                if (dotLane === -1) dotLane = j;
                else lanes[j] = null; // sibling lanes pointing here converge into dotLane
            }
        }

        if (dotLane === -1) {
            // Branch tip (no child pointed at this commit) → new lane, fresh color
            dotLane = lanes.indexOf(null);
            if (dotLane === -1) {
                dotLane = lanes.length;
                lanes.push(null);
            }
            laneColors[dotLane] = allocColor();
        }

        const dotColor = colorFor(dotLane);

        const p0 = c.parents && c.parents.length > 0 ? c.parents[0].id : null;
        lanes[dotLane] = p0; // lane continues with the same color
        laneReach[dotLane] = cReach; // the descending edge below c is owned by c

        const mergeTargets: number[] = [];
        if (c.parents && c.parents.length > 1) {
            for (let p = 1; p < c.parents.length; p++) {
                const pId = c.parents[p].id;
                let mergeLane = lanes.indexOf(pId);
                if (mergeLane === -1) {
                    mergeLane = lanes.indexOf(null);
                    if (mergeLane === -1) {
                        mergeLane = lanes.length;
                        lanes.push(null);
                    }
                    lanes[mergeLane] = pId;
                    laneColors[mergeLane] = allocColor();
                }
                // The lane descending toward this merge parent carries c's edge, so
                // it's on HEAD's history iff c is (keep any prior reachable owner).
                laneReach[mergeLane] = !!laneReach[mergeLane] || cReach;
                mergeTargets.push(mergeLane);
            }
        }

        const lines: GraphLine[] = [];

        for (let k = 0; k < inLanes.length; k++) {
            // Lines entering from ABOVE use the colour the lane had above (inColors),
            // not the post-reassignment colour, so a converging branch keeps its hue.
            const inColor = inColors[k] ?? colorFor(k);
            // A line entering from above belongs to the child that set this lane,
            // so its dimming reads that edge's reachability (inReach[k]) — NOT the
            // destination dot's (cReach). Otherwise an off-branch line feeding a
            // shared parent would inherit the parent's colour.
            if (inLanes[k] === c.id) {
                if (k === dotLane) {
                    lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${midY}`, color: inColor, dimmed: !inReach[k] });
                } else {
                    // Converging branch: straight down its own lane, a rounded
                    // corner at the middle, then a horizontal run into the dot —
                    // so multi-lane jumps read as clean L-bends, not wide swoops.
                    const sgn = dotLane > k ? 1 : -1;
                    const r = Math.min(cornerR, Math.abs(x(dotLane) - x(k)));
                    lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${midY - r} Q ${x(k)} ${midY}, ${x(k) + sgn * r} ${midY} L ${x(dotLane)} ${midY}`, color: inColor, dimmed: !inReach[k] });
                }
            } else if (inLanes[k] !== null) {
                // Line just passing straight through this row keeps its lane color
                lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${cellH}`, color: inColor, dimmed: !inReach[k] });
            }
        }

        // Continuation down to the next row. Position-independent (no "is last
        // row" check) so nodes never change when more pages load — the last row
        // of a page connects seamlessly to the first row of the next.
        if (p0) {
            // Dim the continuation when THIS commit is off-branch — not just when
            // its parent is. A merge can make the parent reachable while this
            // (off-branch) commit stays dimmed, which otherwise left a bright line
            // hanging off a greyed-out dot.
            lines.push({ path: `M ${x(dotLane)} ${midY} L ${x(dotLane)} ${cellH}`, color: dotColor, dimmed: !cReach });
        }

        for (const mL of mergeTargets) {
            // Merge parent: horizontal out of the dot along the middle, a rounded
            // corner, then straight down the target lane.
            const sgn = mL > dotLane ? 1 : -1;
            const r = Math.min(cornerR, Math.abs(x(mL) - x(dotLane)));
            lines.push({ path: `M ${x(dotLane)} ${midY} L ${x(mL) - sgn * r} ${midY} Q ${x(mL)} ${midY}, ${x(mL)} ${midY + r} L ${x(mL)} ${cellH}`, color: colorFor(mL), dimmed: !cReach });
        }

        // Widest lane index ANY line on this row actually touches. Must be computed
        // from the lines' real endpoints — the incoming (inLanes) pass-through lines
        // and merge targets can sit on lanes past the current lanes[] length, so
        // sizing the column off lanes.length alone let those lines overflow to the
        // right and paint over the commit text. This bounds the column to the lines.
        let maxLane = dotLane;
        for (const mL of mergeTargets) if (mL > maxLane) maxLane = mL;
        for (let k = 0; k < inLanes.length; k++)
            if (inLanes[k] !== null && k > maxLane) maxLane = k;
        for (let k = 0; k < lanes.length; k++)
            if (lanes[k] !== null && k > maxLane) maxLane = k;

        // Drop trailing empty lanes so the graph width tracks the lanes that are
        // actually active on this row instead of the historical peak.
        while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
            lanes.pop();
            laneColors.pop();
            laneReach.pop();
        }

        map.set(c.id, {
            dotLane,
            color: dotColor,
            lines,
            width: (maxLane + 1) * laneW + 20,
            isMerge: !!(c.parents && c.parents.length > 1),
            dimmed: !cReach,
            isHead: !!headId && c.id === headId
        });
    }
}

/** Full (non-incremental) build — used on a fresh log / repo or ref switch. */
export function buildCommitGraph(log: Commit[], headCommitId: string | null = null): Map<string, GraphNode> {
    const map = new Map<string, GraphNode>();
    if (!log || log.length === 0) return map;
    appendCommitGraph(map, createGraphState(), log, headCommitId);
    return map;
}

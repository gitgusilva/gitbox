import { Commit, GraphLine, GraphNode } from './types/git';

const COLORS = [
    '#1E88E5', '#ffab00', '#00e676', '#d500f9', '#ff3d00', '#00b0ff', '#1de9b6', '#f50057', '#ffea00'
];

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
    nextColor: number;
}

export function createGraphState(): GraphState {
    return { lanes: [], laneColors: [], nextColor: 0 };
}

/**
 * Lays out `commits` (newest→oldest, continuing from `state`) into `map`,
 * mutating both. Each node depends only on the lane state *before* it — never on
 * its absolute position in the log — so appended pages cost O(Δ) instead of the
 * O(n) full rebuild that made infinite scroll O(n²).
 */
export function appendCommitGraph(map: Map<string, GraphNode>, state: GraphState, commits: Commit[]): void {
    if (!commits || commits.length === 0) return;

    const { lanes, laneColors } = state;
    const allocColor = () => COLORS[state.nextColor++ % COLORS.length];
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
        const inLanes = [...lanes];
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
                mergeTargets.push(mergeLane);
            }
        }

        const lines: GraphLine[] = [];

        for (let k = 0; k < inLanes.length; k++) {
            if (inLanes[k] === c.id) {
                const color = colorFor(k);
                if (k === dotLane) {
                    lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${midY}`, color });
                } else {
                    // Converging branch: straight down its own lane, a rounded
                    // corner at the middle, then a horizontal run into the dot —
                    // so multi-lane jumps read as clean L-bends, not wide swoops.
                    const sgn = dotLane > k ? 1 : -1;
                    const r = Math.min(cornerR, Math.abs(x(dotLane) - x(k)));
                    lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${midY - r} Q ${x(k)} ${midY}, ${x(k) + sgn * r} ${midY} L ${x(dotLane)} ${midY}`, color });
                }
            } else if (inLanes[k] !== null) {
                // Line just passing straight through this row keeps its lane color
                lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${cellH}`, color: colorFor(k) });
            }
        }

        // Continuation down to the next row. Position-independent (no "is last
        // row" check) so nodes never change when more pages load — the last row
        // of a page connects seamlessly to the first row of the next.
        if (p0) {
            lines.push({ path: `M ${x(dotLane)} ${midY} L ${x(dotLane)} ${cellH}`, color: dotColor });
        }

        for (const mL of mergeTargets) {
            // Merge parent: horizontal out of the dot along the middle, a rounded
            // corner, then straight down the target lane.
            const sgn = mL > dotLane ? 1 : -1;
            const r = Math.min(cornerR, Math.abs(x(mL) - x(dotLane)));
            lines.push({ path: `M ${x(dotLane)} ${midY} L ${x(mL) - sgn * r} ${midY} Q ${x(mL)} ${midY}, ${x(mL)} ${midY + r} L ${x(mL)} ${cellH}`, color: colorFor(mL) });
        }

        // Drop trailing empty lanes so the graph width tracks the lanes that are
        // actually active on this row instead of the historical peak.
        while (lanes.length > 0 && lanes[lanes.length - 1] === null) {
            lanes.pop();
            laneColors.pop();
        }

        map.set(c.id, {
            dotLane,
            color: dotColor,
            lines,
            width: Math.max(lanes.length * laneW + 20, (dotLane + 1) * laneW + 20),
            isMerge: !!(c.parents && c.parents.length > 1)
        });
    }
}

/** Full (non-incremental) build — used on a fresh log / repo or ref switch. */
export function buildCommitGraph(log: Commit[], _headCommitId: string | null = null): Map<string, GraphNode> {
    const map = new Map<string, GraphNode>();
    if (!log || log.length === 0) return map;
    appendCommitGraph(map, createGraphState(), log);
    return map;
}

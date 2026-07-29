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
/**
 * One branch line still looking for its next commit. Identity lives on the
 * object, not on an array slot, so a line keeps its colour and knows where it
 * was last drawn even as it slides between columns.
 */
interface Lane {
    /** Commit id this line is descending towards. */
    next: string;
    // Stable colour: a lane keeps its colour for as long as it stays a continuous
    // chain, so each branch keeps one colour all the way down (SourceGit-style)
    // instead of recolouring whenever it changes column.
    color: string;
    // Reachability of the EDGE currently descending in this lane, i.e. whether the
    // child commit that owns this line is reachable from a root. A line is on the
    // highlighted history only if the child it flows *from* is reachable — tying
    // line colour to the destination dot instead paints a colour onto an
    // off-branch line whenever its parent is shared with a root.
    reach: boolean;
    /** Column this line was last drawn in, i.e. where it enters the next row. */
    lastX: number;
}

export interface GraphState {
    // Ordered list of live lines; a lane's POSITION is its column. Ending a lane
    // removes it, so everything to its right slides one column left on the rows
    // below — the compaction that gives SourceGit's graph its braided look and
    // keeps the graph as narrow as the history actually needs.
    lanes: Lane[];
    nextColor: number;
    // Commit ids reachable from a root, grown newest→oldest: when a reachable commit
    // is laid out its parents are added, so the whole highlighted ancestry gets
    // marked. Anything left unmarked is off-branch and drawn dim (SourceGit-style).
    reachable: Set<string>;
}

export function createGraphState(): GraphState {
    return { lanes: [], nextColor: 0, reachable: new Set() };
}

/**
 * Lays out `commits` (newest→oldest, continuing from `state`) into `map`,
 * mutating both. Each node depends only on the lane state *before* it — never on
 * its absolute position in the log — so appended pages cost O(Δ) instead of the
 * O(n) full rebuild that made infinite scroll O(n²).
 */
export function appendCommitGraph(
    map: Map<string, GraphNode>,
    state: GraphState,
    commits: Commit[],
    headId: string | null = null,
    roots: string[] | null = null
): void {
    if (!commits || commits.length === 0) return;

    // Highlight roots: everything reachable from one of them keeps its colour, the
    // rest is dimmed. Defaults to HEAD alone (current-branch highlighting); callers
    // pass the filtered refs' tips so a branch the user explicitly filtered for is
    // NOT greyed out just because it isn't part of HEAD's ancestry. No roots (e.g.
    // HEAD not in this view and no filter) -> dimming off, everything stays coloured.
    const seeds = roots && roots.length ? roots : (headId ? [headId] : []);
    const dimEnabled = seeds.length > 0;
    // Seed on every call: a root can be the tip of a branch that only shows up in a
    // later page, and Set.add is idempotent for the ones already marked.
    for (const r of seeds) state.reachable.add(r);
    const reach = (id: string | null) => !dimEnabled || (id != null && state.reachable.has(id));
    const palette = readPalette();
    const allocColor = () => palette[state.nextColor++ % palette.length];

    // Each history row is 30px tall (ROW_HEIGHT in HistoryCommitList). The cell
    // spans the FULL row and overlaps its neighbours by ~1px on each end, else
    // consecutive rows' vertical lines leave a 1px gap that reads as a "cut" at
    // every row boundary. The per-row SVG uses overflow-visible, so drawing
    // slightly out of bounds is safe.
    const cellTop = -1;
    const cellH = 31;
    const midY = 14;
    const laneW = 12;
    const offset = 10;
    const x = (l: number) => l * laneW + offset;

    // --- Curve shapes ------------------------------------------------------
    // Every lateral move is one curve whose control points sit on the corner, so a
    // line leaves along its own column and only turns as it arrives: a single
    // sweep, never the L-bend the graph used to draw.
    //
    // Keeping them APART is a separate problem from keeping them smooth. Every
    // line arriving at a dot ends on the same point, and with only half a row of
    // vertical budget a single curve straight into it flattens against y = midY:
    // measured on a real row, a converging branch and the merge edge leaving the
    // same dot ran within 1px of each other from x=10 to x=50, so one simply
    // painted over the other and looked cut in half.
    //
    // So each line gets its own TRACK -- the height it runs at before turning into
    // the dot. Branches arriving nest in the band ABOVE the dot (the one coming
    // from furthest away rides highest, so the fan nests outside-in) and merge
    // edges leaving occupy the band BELOW it. The two families can then never
    // share a stroke, and members of a family only meet where the dot covers them.

    /** Vertical midpoint of a full-row slide, where its S-curve inflects. */
    const slideMid = (cellTop + cellH) / 2;

    // Merge edges get their own band BELOW the dot. Arriving branches all flatten
    // against y = midY as they close on the dot -- that is what makes them nest --
    // so an edge LEAVING along the same line ran within 1px of one of them for
    // 40px and painted straight over it, which is what looked like a broken green
    // line. Pushing the departures one band down separates the two families by
    // construction, without touching the fan that arrivals form naturally.
    const LEAVE_BASE = 2;     // first departing track, measured down from the dot
    const LEAVE_GAP = 6;      // vertical spacing between successive departures
    const LEAVE_TURN = 0.8;   // how late a departure dives into its target column

    /** Height the j-th merge edge leaving the dot runs at (nearest column first). */
    const leaveTrack = (j: number) => Math.min(cellH - 2, midY + LEAVE_BASE + j * LEAVE_GAP);

    /**
     * A line flowing straight through this row. When lane compaction slides it
     * sideways it gets SourceGit's cubic, which spends the whole row height on the
     * turn -- that long, gentle S is what makes a column shift read as one sweep
     * instead of a kink. The +/-4 offset on the control points is SourceGit's too:
     * it keeps the ends vertical so the curve joins the rows above and below
     * without a visible corner.
     */
    const passPath = (from: number, to: number) =>
        from === to
            ? `M ${x(from)} ${cellTop} L ${x(from)} ${cellH}`
            : `M ${x(from)} ${cellTop} C ${x(from)} ${slideMid + 4}, ${x(to)} ${slideMid - 4}, ${x(to)} ${cellH}`;

    /**
     * A line arriving at this row's dot -- the lane that owns it, or a branch
     * converging into it. Down its own column, then a rounded turn into the dot.
     * A quadratic is deliberate: its x moves as t², so a branch from a far column
     * stays wide for longer and the arrivals nest as concentric arcs, one per
     * source column. Anything that spread them onto separate tracks instead
     * collapsed into a single bundle as soon as more than three branches met.
     */
    const toDotPath = (from: number, to: number) =>
        from === to
            ? `M ${x(from)} ${cellTop} L ${x(from)} ${midY}`
            : `M ${x(from)} ${cellTop} Q ${x(from)} ${midY}, ${x(to)} ${midY}`;

    /**
     * Merge edge leaving the dot for a second parent's column: down out of the dot,
     * across its own track, then into that column. Its LAST control sits in the
     * target column so it settles in vertically and joins the next row cleanly.
     * one band lower. Its LAST control sits in the target column so it settles in
     * vertically and joins the next row cleanly.
     */
    const mergePath = (from: number, to: number, rank: number) => {
        if (from === to) return `M ${x(from)} ${midY} L ${x(from)} ${cellH}`;
        const t = leaveTrack(rank);
        const dive = x(from) + (x(to) - x(from)) * LEAVE_TURN;
        return `M ${x(from)} ${midY} C ${dive} ${t}, ${x(to)} ${t}, ${x(to)} ${cellH}`;
    };

    for (const c of commits) {
        // Reachable-from-HEAD is settled by now (all children precede a commit in
        // topological order); propagate to parents so the ancestry keeps its color.
        const cReach = reach(c.id);
        if (dimEnabled && cReach && c.parents) for (const p of c.parents) state.reachable.add(p.id);

        const incoming = state.lanes;
        // Reachability of each line as it ENTERS the row. A line belongs to the
        // child that set it, so its dimming must read the value the lane had before
        // this row reassigns it -- otherwise an off-branch line feeding a shared
        // parent would inherit the parent's colour.
        const reachIn = new Map<Lane, boolean>();
        for (const l of incoming) reachIn.set(l, l.reach);

        // Walk the live lanes in order to build this row's columns. The first lane
        // pointing at this commit owns the dot and keeps its column; any sibling
        // pointing here converges into it and gives its column up, which is what
        // makes everything to the right slide left.
        const columns: Lane[] = [];
        let major: Lane | null = null;
        for (const l of incoming) {
            // A converging sibling is simply left out of `columns` — that missing
            // column is the compaction.
            if (l.next === c.id) {
                if (!major) { major = l; columns.push(l); }
            } else {
                columns.push(l);
            }
        }

        const p0 = c.parents && c.parents.length > 0 ? c.parents[0].id : null;
        if (!major) {
            // Branch tip: nothing above pointed here, so it opens a column of its
            // own at the right edge with a fresh colour.
            major = { next: '', color: allocColor(), reach: cReach, lastX: columns.length };
            columns.push(major);
        }
        const dotLane = columns.indexOf(major);
        const dotColor = major.color;

        // The lane now descends towards the first parent, carrying c's edge.
        major.next = p0 ?? '';
        major.reach = cReach;

        const mergeTargets: { lane: Lane; column: number }[] = [];
        if (c.parents && c.parents.length > 1) {
            for (let p = 1; p < c.parents.length; p++) {
                const pId = c.parents[p].id;
                let target = columns.find(l => l.next === pId);
                if (!target) {
                    target = { next: pId, color: allocColor(), reach: cReach, lastX: columns.length };
                    columns.push(target);
                }
                // The line descending toward this merge parent carries c's edge, so
                // it's on HEAD's history iff c is (keep any prior reachable owner).
                target.reach = target.reach || cReach;
                mergeTargets.push({ lane: target, column: columns.indexOf(target) });
            }
        }

        const column = new Map<Lane, number>();
        columns.forEach((l, i) => column.set(l, i));

        const lines: GraphLine[] = [];

        // Lines entering from above, each drawn from the column it was last left in.
        // A lane with no surviving column converged into the dot; so did `major`,
        // which owns it. Everything else flows on through the row.
        for (const l of incoming) {
            const dimmed = !reachIn.get(l);
            const to = column.get(l);
            lines.push(to === undefined || l === major
                ? { path: toDotPath(l.lastX, dotLane), color: l.color, dimmed }
                : { path: passPath(l.lastX, to), color: l.color, dimmed });
        }

        // Continuation down to the next row. Position-independent (no "is last
        // row" check) so nodes never change when more pages load -- the last row
        // of a page connects seamlessly to the first row of the next.
        if (p0) {
            // Dim the continuation when THIS commit is off-branch -- not just when
            // its parent is. A merge can make the parent reachable while this
            // (off-branch) commit stays dimmed, which otherwise left a bright line
            // hanging off a greyed-out dot.
            lines.push({ path: `M ${x(dotLane)} ${midY} L ${x(dotLane)} ${cellH}`, color: dotColor, dimmed: !cReach });
        }

        // Nearest merge target rides the track closest to the dot, same nesting.
        const mergeRank = new Map<Lane, number>();
        [...mergeTargets]
            .sort((a, b) => Math.abs(a.column - dotLane) - Math.abs(b.column - dotLane))
            .forEach((t, i) => mergeRank.set(t.lane, i));
        for (const t of mergeTargets) {
            lines.push({ path: mergePath(dotLane, t.column, mergeRank.get(t.lane) ?? 0), color: t.lane.color, dimmed: !cReach });
        }

        // Widest column ANY line on this row actually touches. Converging lines can
        // come from a column further right than anything that survives the row, so
        // this has to look at where lines were drawn FROM as well as the surviving
        // columns -- sizing off the latter alone let those lines overflow right and
        // paint over the commit text.
        let maxLane = columns.length - 1;
        for (const l of incoming) if (l.lastX > maxLane) maxLane = l.lastX;

        // Remember where each surviving line now sits, so the next row draws it from
        // the right place however much the columns shifted.
        for (const l of columns) l.lastX = column.get(l)!;

        // A commit with no parent ends its lane; everything right of it compacts on
        // the rows below. Tips that are also roots never make it into the state.
        state.lanes = p0 ? columns : columns.filter(l => l !== major);

        // Where two lines do cross, the one on the highlighted history wins the
        // pixel: dimmed lanes are painted first so an off-branch line can never
        // sit over the ancestry the user is actually following.
        lines.sort((a, b) => Number(!!b.dimmed) - Number(!!a.dimmed));

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
export function buildCommitGraph(log: Commit[], headCommitId: string | null = null, roots: string[] | null = null): Map<string, GraphNode> {
    const map = new Map<string, GraphNode>();
    if (!log || log.length === 0) return map;
    appendCommitGraph(map, createGraphState(), log, headCommitId, roots);
    return map;
}

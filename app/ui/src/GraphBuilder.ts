import { Commit, GraphLine, GraphNode } from './types/git';

export function buildCommitGraph(log: Commit[], headCommitId: string | null = null): Map<string, GraphNode> {
    const lanes: (string | null)[] = [];
    const map = new Map<string, GraphNode>();
    if (!log || log.length === 0) return map;

    const colors = [
        '#1E88E5', '#ffab00', '#00e676', '#d500f9', '#ff3d00', '#00b0ff', '#1de9b6', '#f50057', '#ffea00'
    ];

    const activeAncestors = new Set<string>();
    if (headCommitId) {
        activeAncestors.add(headCommitId);
    } else if (log.length > 0) {
        activeAncestors.add(log[0].id);
    }

    for (let i = 0; i < log.length; i++) {
        const c = log[i];

        const isMerged = activeAncestors.has(c.id);
        if (isMerged && c.parents) {
            c.parents.forEach(p => activeAncestors.add(p.id));
        }

        const inLanes = [...lanes];
        let dotLane = -1;
        for (let j = 0; j < inLanes.length; j++) {
            if (inLanes[j] === c.id) {
                if (dotLane === -1) dotLane = j;
                lanes[j] = null;
            }
        }

        if (dotLane === -1) {
            dotLane = lanes.indexOf(null);
            if (dotLane === -1) {
                dotLane = lanes.length;
                lanes.push(null);
            }
        }

        const p0 = c.parents && c.parents.length > 0 ? c.parents[0].id : null;
        lanes[dotLane] = p0;

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
                }
                mergeTargets.push(mergeLane);
            }
        }

        const lines: GraphLine[] = [];
        const cellTop = -0.5;
        const cellH = 28.5;
        const midY = 14;
        const curveTension = 11;
        const laneW = 12;
        const offset = 10;
        const x = (l: number) => l * laneW + offset;

        for (let k = 0; k < inLanes.length; k++) {
            if (inLanes[k] === c.id) {
                const color = isMerged ? colors[k % colors.length] : '#555555';
                if (k === dotLane) {
                    lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${midY}`, color });
                } else {
                    lines.push({ path: `M ${x(k)} ${cellTop} C ${x(k)} ${cellTop + curveTension}, ${x(dotLane)} ${midY - curveTension}, ${x(dotLane)} ${midY}`, color });
                }
            } else if (inLanes[k] !== null) {
                // Dim lines purely passing through if they are NOT heading towards an active ancestor
                const passTheme = activeAncestors.has(inLanes[k]!) ? colors[k % colors.length] : '#555555';
                lines.push({ path: `M ${x(k)} ${cellTop} L ${x(k)} ${cellH}`, color: passTheme });
            }
        }

        if (p0) {
            if (i < log.length - 1) {
                const laneColor = isMerged ? colors[dotLane % colors.length] : '#555555';
                lines.push({ path: `M ${x(dotLane)} ${midY} L ${x(dotLane)} ${cellH}`, color: laneColor });
            }
        }

        for (const mL of mergeTargets) {
            const laneColor = isMerged ? colors[mL % colors.length] : '#555555';
            lines.push({ path: `M ${x(dotLane)} ${midY} C ${x(dotLane)} ${midY + curveTension}, ${x(mL)} ${cellH - curveTension}, ${x(mL)} ${cellH}`, color: laneColor });
        }

        map.set(c.id, {
            dotLane,
            color: isMerged ? colors[dotLane % colors.length] : '#555555',
            lines,
            width: Math.max(lanes.length * laneW + 20, (dotLane + 1) * laneW + 20),
            isMerge: c.parents && c.parents.length > 1
        });
    }

    return map;
}

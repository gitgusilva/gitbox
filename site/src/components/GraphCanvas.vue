<script setup lang="ts">
/**
 * Animated commit graph, drawn on a 2D canvas — a few KB and no dependency,
 * where a WebGL scene would have cost ~150KB of three.js for the same idea.
 *
 * Lanes scroll upward continuously; nodes and merge curves are generated on the
 * fly, so the drawing never repeats exactly. It sits behind the hero at low
 * opacity, freezes for `prefers-reduced-motion`, and pauses when off-screen.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

const canvas = ref<HTMLCanvasElement | null>(null);
let raf = 0;
let observer: IntersectionObserver | null = null;
let sizeObserver: ResizeObserver | null = null;

const LANE_COLORS = ['#1E88E5', '#00ACC1', '#7CB342', '#FFB300', '#D81B60', '#8E24AA'];
const ROW_GAP = 58;
const SPEED = 14; // px per second

interface Row {
    y: number;
    lane: number;
    /** Lane this row merges into, if any. */
    mergeInto: number | null;
    isMerge: boolean;
}

onMounted(() => {
    const el = canvas.value;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let laneCount = 4;
    let rows: Row[] = [];

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = el!.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        el!.width = Math.floor(width * dpr);
        el!.height = Math.floor(height * dpr);
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        laneCount = Math.max(4, Math.min(10, Math.round(width / 130)));
        seed();
    }

    /** Fills the canvas height with rows, bottom-up. */
    function seed() {
        rows = [];
        let y = height + ROW_GAP;
        // Start somewhere in the middle so the walk uses the whole width instead
        // of clinging to lane 0 for the first screenful.
        let lane = Math.floor(Math.random() * laneCount);
        while (y > -ROW_GAP * 2) {
            lane = nextLane(lane);
            const isMerge = Math.random() < 0.22 && lane > 0;
            rows.push({
                y,
                lane,
                isMerge,
                mergeInto: isMerge ? Math.max(0, lane - 1 - Math.floor(Math.random() * 2)) : null
            });
            y -= ROW_GAP;
        }
    }

    // A pure random walk lingers on whichever side it happens to be on. Instead
    // the walk is pulled toward a target lane that jumps to the far side every
    // few rows, so the graph keeps crossing the full width.
    let targetLane = 0;
    let rowsToRetarget = 0;

    function nextLane(previous: number): number {
        if (rowsToRetarget <= 0) {
            const half = (laneCount - 1) / 2;
            // Aim at the opposite half of the canvas from where we are now.
            targetLane = previous > half
                ? Math.floor(Math.random() * Math.ceil(half))
                : Math.ceil(half) + Math.floor(Math.random() * Math.ceil(half));
            targetLane = Math.max(0, Math.min(laneCount - 1, targetLane));
            rowsToRetarget = 4 + Math.floor(Math.random() * 5);
        }
        rowsToRetarget--;

        if (previous === targetLane) return previous;
        // Mostly advance toward the target, occasionally hold for a beat so the
        // movement doesn't read as a straight diagonal.
        return Math.random() < 0.75 ? previous + Math.sign(targetLane - previous) : previous;
    }

    /** Lanes fan out across the full width so the graph reads as a backdrop
     *  rather than a strip hugging the left edge. */
    const laneX = (lane: number) => {
        const margin = Math.min(120, width * 0.08);
        const span = width - margin * 2;
        return margin + (span / Math.max(1, laneCount - 1)) * lane;
    };

    function draw() {
        ctx!.clearRect(0, 0, width, height);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const next = rows[i + 1]; // the row above (older rows sit lower)
            const x = laneX(row.lane);
            const color = LANE_COLORS[row.lane % LANE_COLORS.length];

            ctx!.strokeStyle = color;
            ctx!.lineWidth = 2.4;
            ctx!.globalAlpha = 1;

            // Line running up to the next row, bending when the lane changes.
            if (next) {
                const nx = laneX(next.lane);
                ctx!.beginPath();
                ctx!.moveTo(x, row.y);
                if (nx === x) {
                    ctx!.lineTo(x, next.y);
                } else {
                    const midY = row.y - ROW_GAP / 2;
                    const r = Math.min(14, Math.abs(nx - x) / 2);
                    ctx!.lineTo(x, midY + r);
                    ctx!.quadraticCurveTo(x, midY, x + Math.sign(nx - x) * r, midY);
                    ctx!.lineTo(nx - Math.sign(nx - x) * r, midY);
                    ctx!.quadraticCurveTo(nx, midY, nx, midY - r);
                    ctx!.lineTo(nx, next.y);
                }
                ctx!.stroke();
            }

            // Merge arm reaching into a lane on the left.
            if (row.mergeInto !== null) {
                const mx = laneX(row.mergeInto);
                ctx!.globalAlpha = 0.65;
                ctx!.beginPath();
                ctx!.moveTo(x, row.y);
                ctx!.quadraticCurveTo(mx, row.y, mx, row.y - ROW_GAP);
                ctx!.stroke();
            }

            // The commit dot.
            ctx!.globalAlpha = 1;
            ctx!.fillStyle = color;
            ctx!.beginPath();
            ctx!.arc(x, row.y, row.isMerge ? 6 : 4.5, 0, Math.PI * 2);
            ctx!.fill();

            if (row.isMerge) {
                ctx!.strokeStyle = '#0B0D10';
                ctx!.lineWidth = 1.6;
                ctx!.beginPath();
                ctx!.moveTo(x - 2.6, row.y);
                ctx!.lineTo(x + 2.6, row.y);
                ctx!.moveTo(x, row.y - 2.6);
                ctx!.lineTo(x, row.y + 2.6);
                ctx!.stroke();
            }
        }
        ctx!.globalAlpha = 1;
    }

    let last = 0;
    function frame(now: number) {
        const dt = last ? (now - last) / 1000 : 0;
        last = now;

        for (const row of rows) row.y -= SPEED * dt;

        // Recycle: drop rows that left the top, append new ones at the bottom.
        while (rows.length && rows[rows.length - 1].y < -ROW_GAP) rows.pop();
        while (rows.length && rows[0].y < height + ROW_GAP) {
            const lane = nextLane(rows[0].lane);
            const isMerge = Math.random() < 0.22 && lane > 0;
            rows.unshift({
                y: rows[0].y + ROW_GAP,
                lane,
                isMerge,
                mergeInto: isMerge ? Math.max(0, lane - 1 - Math.floor(Math.random() * 2)) : null
            });
        }

        draw();
        raf = requestAnimationFrame(frame);
    }

    resize();
    // A window-resize listener is not enough: the hero grows when the product
    // screenshot below finishes loading, which changes this canvas's box without
    // any window event. The bitmap would keep its old aspect ratio and the
    // browser would stretch it — turning the round commit dots into ellipses.
    sizeObserver = new ResizeObserver(() => resize());
    sizeObserver.observe(el);

    if (reduced) {
        draw(); // a single static frame
    } else {
        // Only animate while the hero is actually on screen.
        observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !raf) {
                last = 0;
                raf = requestAnimationFrame(frame);
            } else if (!entry.isIntersecting && raf) {
                cancelAnimationFrame(raf);
                raf = 0;
            }
        });
        observer.observe(el);
    }

    onBeforeUnmount(() => {
        sizeObserver?.disconnect();
        observer?.disconnect();
        if (raf) cancelAnimationFrame(raf);
    });
});
</script>

<template>
  <canvas ref="canvas" class="h-full w-full" aria-hidden="true"></canvas>
</template>

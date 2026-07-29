<script setup lang="ts">
import { computed } from 'vue';
import { GraphNode, GraphLine } from '../types/git';

const props = defineProps<{
  node?: GraphNode;
  selected?: boolean;
}>();

const colWidth = computed(() => props.node?.width || 0);

// Off-branch (not reachable from HEAD) styling, SourceGit-style. Dots are OPAQUE
// (so the lines behind them don't show through); lines are the same colour at
// half strength. Both come from the theme's muted-text token — they used to be
// hardcoded greys that clashed with any theme not built around #1E1E1E.
const DIM_DOT = 'rgb(var(--gb-text-muted))';
const DIM_LINE = 'rgb(var(--gb-text-muted) / 0.5)';

// Themeable merge-glyph color (live CSS var: recolors on theme change).
const markerColor = 'rgb(var(--gb-graph-marker))';

// The ring that separates a dot from the lines running under it: the row's own
// background, so it reads as a cut-out. Was a hardcoded white / #181818 pair,
// which drew a bright halo on any custom background.
const ringColor = 'rgb(var(--gb-bg))';
const cx = computed(() => (props.node?.dotLane || 0) * 12 + 10);
const dotColor = computed(() => (props.node?.dimmed ? DIM_DOT : (props.node?.color || DIM_DOT)));
const lineStroke = (line: GraphLine) => (line.dimmed ? DIM_LINE : line.color);
</script>

<template>
  <div class="h-full flex-shrink-0 relative overflow-visible z-20" :style="{ width: colWidth + 'px' }">
    <svg class="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none" :width="colWidth" height="30">
      <!-- Lines arrive already ordered by GraphBuilder (dimmed first), so a
           highlighted lane always wins a crossing. Dots are opaque and drawn
           after, hiding the few pixels where converging curves meet. -->
      <!-- Colours go through :style, never the fill/stroke ATTRIBUTES: the themed
           ones are `rgb(var(--gb-…))`, and var() is only substituted in CSS
           declarations — in a presentation attribute it is an invalid paint and
           the shape silently loses its colour. -->
      <path v-for="(line, i) in (node?.lines || [])" :key="i" :d="line.path" fill="none" :style="{ stroke: lineStroke(line) }" stroke-width="2" stroke-linecap="round" />

      <!-- Selection ring (drawn under the dot) -->
      <circle v-if="selected" :cx="cx" cy="14" r="7" fill="none" :style="{ stroke: dotColor }" stroke-width="1.5" />

      <!-- HEAD: a "target" — outer ring + inner filled core -->
      <template v-if="node?.isHead">
        <circle :cx="cx" cy="14" r="6" fill="none" :style="{ stroke: dotColor }" stroke-width="1.5" />
        <circle :cx="cx" cy="14" r="3" :style="{ fill: dotColor, stroke: ringColor }" stroke-width="0.75" />
      </template>
      <!-- Merge: a bigger filled dot with a clear, thin '+' carved in the row bg color -->
      <template v-else-if="node?.isMerge">
        <circle :cx="cx" cy="14" r="5.5" :style="{ fill: dotColor, stroke: ringColor }" stroke-width="1" />
        <path :d="`M ${cx - 3.2} 14 L ${cx + 3.2} 14 M ${cx} 10.8 L ${cx} 17.2`" :style="{ stroke: markerColor }" stroke-width="1.5" stroke-linecap="round" />
      </template>
      <!-- Normal commit: filled dot -->
      <circle v-else :cx="cx" cy="14" r="4.5" :style="{ fill: dotColor, stroke: ringColor }" stroke-width="1" />
    </svg>
  </div>
</template>

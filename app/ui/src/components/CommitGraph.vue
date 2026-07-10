<script setup lang="ts">
import { computed } from 'vue';
import { GraphNode, GraphLine } from '../types/git';

const props = defineProps<{
  node?: GraphNode;
  selected?: boolean;
}>();

const colWidth = computed(() => props.node?.width || 0);

// Off-branch (not reachable from HEAD) styling, SourceGit-style. Dots are OPAQUE
// gray (so the lines behind them don't show through); lines are a lighter gray.
const DIM_DOT = '#8b8b8b';
const DIM_LINE = 'rgba(139,139,139,0.5)';

// Themeable merge-glyph color (live CSS var: recolors on theme change).
const markerColor = 'rgb(var(--gb-graph-marker))';
const cx = computed(() => (props.node?.dotLane || 0) * 12 + 10);
const dotColor = computed(() => (props.node?.dimmed ? DIM_DOT : (props.node?.color || DIM_DOT)));
const lineStroke = (line: GraphLine) => (line.dimmed ? DIM_LINE : line.color);
</script>

<template>
  <div class="h-full flex-shrink-0 relative overflow-visible z-20" :style="{ width: colWidth + 'px' }">
    <svg class="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none" :width="colWidth" height="30">
      <!-- Lines (dimmed lanes drawn first is not needed; dots are opaque) -->
      <path v-for="(line, i) in (node?.lines || [])" :key="i" :d="line.path" fill="none" :stroke="lineStroke(line)" stroke-width="2" stroke-linecap="round" />

      <!-- Selection ring (drawn under the dot) -->
      <circle v-if="selected" :cx="cx" cy="14" r="7" fill="none" :stroke="dotColor" stroke-width="1.5" />

      <!-- HEAD: a "target" — outer ring + inner filled core -->
      <template v-if="node?.isHead">
        <circle :cx="cx" cy="14" r="6" fill="none" :stroke="dotColor" stroke-width="1.5" />
        <circle :cx="cx" cy="14" r="3" :fill="dotColor" stroke="white" stroke-width="0.75" class="dark:[stroke:#181818]" />
      </template>
      <!-- Merge: a bigger filled dot with a clear, thin '+' carved in the row bg color -->
      <template v-else-if="node?.isMerge">
        <circle :cx="cx" cy="14" r="5.5" :fill="dotColor" stroke="white" stroke-width="1" class="dark:[stroke:#181818]" />
        <path :d="`M ${cx - 3.2} 14 L ${cx + 3.2} 14 M ${cx} 10.8 L ${cx} 17.2`" :style="{ stroke: markerColor }" stroke-width="1.5" stroke-linecap="round" />
      </template>
      <!-- Normal commit: filled dot -->
      <circle v-else :cx="cx" cy="14" r="4.5" :fill="dotColor" stroke="white" stroke-width="1" class="dark:[stroke:#181818]" />
    </svg>
  </div>
</template>

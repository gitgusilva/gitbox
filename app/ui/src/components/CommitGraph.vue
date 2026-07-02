<script setup lang="ts">
import { GraphNode } from '../types/git';

const props = defineProps<{
  node?: GraphNode;
  selected?: boolean;
}>();
</script>

<template>
  <div class="h-full flex-shrink-0 relative overflow-visible z-20" :style="{ width: (node?.width || 0) + 'px' }">
    <svg class="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none" :width="node?.width || 0" height="30">
      <!-- Lines -->
      <path v-for="(line, i) in (node?.lines || [])" :key="i" :d="line.path" fill="none" :stroke="line.color" stroke-width="2" stroke-linecap="round" />
      <!-- Node Dot -->
      <circle :cx="(node?.dotLane || 0) * 12 + 10" cy="14" r="4.5" :fill="node?.color" stroke="white" stroke-width="1" class="dark:[stroke:#181818]" />
      <path v-if="node?.isMerge" :d="`M ${(node?.dotLane || 0) * 12 + 8.2} 14 L ${(node?.dotLane || 0) * 12 + 11.8} 14 M ${(node?.dotLane || 0) * 12 + 10} 12.2 L ${(node?.dotLane || 0) * 12 + 10} 15.8`" stroke="#ffffff" stroke-width="1" stroke-linecap="round" />
      <circle v-if="selected" :cx="(node?.dotLane || 0) * 12 + 10" cy="14" r="6" fill="none" :stroke="node?.color" stroke-width="1.5" />
    </svg>
  </div>
</template>

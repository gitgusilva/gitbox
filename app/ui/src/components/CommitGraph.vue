<script setup lang="ts">
import { GraphNode } from '../types/git';

const props = defineProps<{
  node?: GraphNode;
  selected?: boolean;
}>();
</script>

<template>
  <div class="h-full flex-shrink-0 relative overflow-visible" :style="{ width: (node?.width || 0) + 'px' }">
    <svg class="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none" :width="node?.width || 0" height="28">
      <!-- Lines -->
      <path v-for="(line, i) in (node?.lines || [])" :key="i" :d="line.path" fill="none" :stroke="line.color" stroke-width="2" class="opacity-90" />
      <!-- Node Dot -->
      <circle :cx="(node?.dotLane || 0) * 12 + 10" cy="14" r="4.5" :fill="node?.color" />
      <path v-if="node?.isMerge" :d="`M ${(node?.dotLane || 0) * 12 + 7.5} 14 L ${(node?.dotLane || 0) * 12 + 12.5} 14 M ${(node?.dotLane || 0) * 12 + 10} 11.5 L ${(node?.dotLane || 0) * 12 + 10} 16.5`" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
      <circle v-if="selected" :cx="(node?.dotLane || 0) * 12 + 10" cy="14" r="6" fill="none" :stroke="node?.color" stroke-width="1.5" />
    </svg>
  </div>
</template>

<script setup lang="ts">
/**
 * Card shell for a single statistics chart: title on the left, that chart's own
 * filter controls on the right. Every chart owns its filters, so narrowing one
 * never disturbs the others.
 */
defineProps<{ title: string }>();
</script>

<template>
  <div class="rounded-lg border border-line bg-surface p-3 flex flex-col min-w-0">
    <div class="flex items-start justify-between gap-2 mb-2 flex-wrap">
      <div class="text-[11px] font-semibold text-content leading-6 shrink-0">{{ title }}</div>
      <div v-if="$slots.filters" class="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
        <slot name="filters" />
      </div>
    </div>
    <slot />
  </div>
</template>

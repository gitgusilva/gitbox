<script setup lang="ts">
/**
 * Compact segmented control used for the small enumerated chart filters. Its
 * height is the shared `CONTROL_H` all the chart-filter controls line up on —
 * the toggles, the contributor picker, the search box and the icon buttons must
 * stay the same size or the filter row looks ragged.
 */
type Value = string | number;

defineProps<{
  modelValue: Value;
  options: { value: Value; label: string }[];
  /** Optional caption rendered before the group. */
  label?: string;
}>();

defineEmits<{ (e: 'update:modelValue', value: Value): void }>();
</script>

<template>
  <div class="flex items-center gap-1.5 shrink-0">
    <span v-if="label" class="text-[10px] text-content-muted">{{ label }}</span>
    <div class="h-stat-control flex items-stretch rounded border border-line overflow-hidden text-[10px]">
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        @click="$emit('update:modelValue', opt.value)"
        :class="[
          'px-2.5 flex items-center transition-colors whitespace-nowrap',
          modelValue === opt.value ? 'bg-accent text-accent-fg' : 'text-content-muted hover:bg-surface-hover'
        ]"
      >{{ opt.label }}</button>
    </div>
  </div>
</template>

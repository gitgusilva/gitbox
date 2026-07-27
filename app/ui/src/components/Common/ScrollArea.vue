<script setup lang="ts">
/**
 * ScrollArea — a thin SimpleBar wrapper that provides consistent custom
 * scrollbars everywhere in the app.
 *
 * Usage:
 *   <ScrollArea class="flex-1">
 *     ... any content ...
 *   </ScrollArea>
 *
 * All class / style / data-* attributes are forwarded to the SimpleBar root.
 */
import { ref } from 'vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

defineOptions({ inheritAttrs: false });

defineProps<{
  /** Hide the scrollbar thumb until the user hovers (default: true = auto-hide) */
  autoHide?: boolean;
}>();

const bar = ref<any>(null);

/**
 * Jump back to the top — for callers that swap the content out underneath, where
 * keeping the old offset lands the user in the middle of something new.
 *
 * SimpleBar scrolls an inner wrapper, not its root, so setting scrollTop on the
 * element this component renders would do nothing; the instance exposes that
 * wrapper as `scrollElement`.
 */
function scrollToTop() {
  const el = bar.value?.scrollElement as HTMLElement | undefined;
  if (el) el.scrollTop = 0;
}

defineExpose({ scrollToTop });
</script>

<template>
  <SimpleBar ref="bar" v-bind="$attrs" :auto-hide="autoHide !== false">
    <slot />
  </SimpleBar>
</template>

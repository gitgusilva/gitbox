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
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

defineOptions({ inheritAttrs: false });

defineProps<{
  /** Hide the scrollbar thumb until the user hovers (default: true = auto-hide) */
  autoHide?: boolean;
}>();
</script>

<template>
  <SimpleBar v-bind="$attrs" :auto-hide="autoHide !== false">
    <slot />
  </SimpleBar>
</template>

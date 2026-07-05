<script setup lang="ts">
import { Ref } from 'vue';
import { startResize, ResizeOptions } from '../../services/layoutService';

const props = defineProps<{
  target: Ref<number>;
  options?: ResizeOptions;
  vertical?: boolean;
}>();

function handleMouseDown(e: MouseEvent) {
    const opts = { ...props.options };
    if (props.vertical && !opts.axis) opts.axis = 'y';
    startResize(props.target, e, opts);
}
</script>

<template>
  <div 
    class="resizer-handle transition-colors z-30 fixed-size"
    :class="[
        vertical ? 'h-1.5 w-full cursor-row-resize hover:bg-accent/50' : 'w-1.5 h-full cursor-col-resize hover:bg-accent/50',
        $attrs.class
    ]"
    @mousedown="handleMouseDown"
  ></div>
</template>

<style scoped>
.resizer-handle {
    user-select: none;
    background-color: transparent;
}
/* Ensure it's always grabable */
.resizer-handle:hover {
    background-color: rgb(var(--gb-accent) / 0.5);
}
</style>

<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue';
import { calculateFloatingPosition, Placement } from '../../utils/floating';
import { cn } from '../../utils/cn';

const props = withDefaults(defineProps<{
    text?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
    delay?: number;
    class?: string;
}>(), {
    position: 'auto',
    delay: 200
});

const isVisible = ref(false);
let timeout: any = null;
const targetRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);

const tooltipStyle = ref({
    top: '0px',
    left: '0px'
});

function calculatePosition() {
    if (!targetRef.value || !tooltipRef.value) return;

    const targetRect = targetRef.value.getBoundingClientRect();
    const tooltipRect = tooltipRef.value.getBoundingClientRect();

    const pos = calculateFloatingPosition({
        targetRect: targetRect,
        floatingRect: tooltipRect,
        placement: props.position as Placement,
        alignment: 'center',
        margin: 8
    });

    tooltipStyle.value = {
        top: pos.top,
        left: pos.left
    };
}

function onEnter() {
    if (!props.text) return;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
        isVisible.value = true;
        nextTick(() => {
            calculatePosition();
        });
    }, props.delay);
}

function onLeave() {
    if (timeout) clearTimeout(timeout);
    isVisible.value = false;
}

onBeforeUnmount(() => {
    if (timeout) clearTimeout(timeout);
});
</script>

<template>
  <div ref="targetRef" :class="cn('inline-center align-middle', props.class)" @mouseenter="onEnter" @mouseleave="onLeave">
    <slot></slot>
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isVisible && text" 
             ref="tooltipRef"
             :class="cn(
               'fixed z-[99999] px-2 py-1 text-[10px] font-medium text-content-strong bg-surface border border-neutral-300/50 dark:border-neutral-700/50 rounded shadow-xl whitespace-pre-wrap max-w-xs pointer-events-none'
             )"
             :style="tooltipStyle">
          {{ text }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

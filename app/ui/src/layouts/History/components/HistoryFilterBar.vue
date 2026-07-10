<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Tooltip from '../../../components/Common/Tooltip.vue';

const { t } = useI18n();

const props = defineProps<{
  /** Active filter refs (branches/tags) shown as badges. */
  refs: string[];
}>();

const emit = defineEmits<{
  (e: 'remove', name: string): void;
}>();

/** Horizontal scroller (hidden scrollbar) + arrows on overflow, like the tab bar. */
const scrollContainer = ref<HTMLElement | null>(null);
const isOverflowing = ref(false);
let resizeObs: ResizeObserver | null = null;

function checkOverflow() {
  const el = scrollContainer.value;
  isOverflowing.value = !!el && el.scrollWidth > el.clientWidth + 2;
}

function scroll(direction: 'left' | 'right') {
  scrollContainer.value?.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' });
}

watch(() => props.refs, () => nextTick(checkOverflow), { deep: true });

onMounted(() => {
  nextTick(checkOverflow);
  if (scrollContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(checkOverflow);
    resizeObs.observe(scrollContainer.value);
  }
});

onBeforeUnmount(() => { resizeObs?.disconnect(); resizeObs = null; });

/** Short label: drop the "origin/" style remote prefix noise for readability. */
function label(ref: string) {
  return ref;
}
</script>

<template>
  <div class="shrink-0 h-9 flex items-center gap-1 border-b border-line bg-surface px-2 select-none">
    <Icon icon="lucide:filter" class="text-content-muted text-[11px] shrink-0" />

    <!-- Scrollable badge strip -->
    <div ref="scrollContainer" class="flex-1 flex items-center gap-1.5 overflow-x-auto filterbar-scroll min-w-0">
      <span v-for="ref in refs" :key="ref"
            :title="ref"
            class="group/badge shrink-0 h-6 pl-2 pr-1 flex items-center gap-1 rounded-full text-[10px] font-mono font-semibold text-accent bg-accent/15 border border-accent/30 max-w-[220px]">
        <Icon icon="lucide:git-branch" class="text-[10px] shrink-0 opacity-70" />
        <span class="truncate">{{ label(ref) }}</span>
        <button @click.stop="emit('remove', ref)"
                :title="t('common.remove')"
                class="shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-accent/70 hover:text-accent-fg hover:bg-accent transition-colors">
          <Icon icon="lucide:x" class="text-[10px]" />
        </button>
      </span>
    </div>

    <!-- Scroll arrows, grouped on the right (only on overflow) — like the repo tabs bar -->
    <div v-if="isOverflowing" class="flex items-center shrink-0 gap-0.5 pl-1">
      <button @click="scroll('left')"
              class="h-6 w-5 flex items-center justify-center rounded text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors">
        <Icon icon="lucide:chevron-left" class="text-xs" />
      </button>
      <button @click="scroll('right')"
              class="h-6 w-5 flex items-center justify-center rounded text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors">
        <Icon icon="lucide:chevron-right" class="text-xs" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.filterbar-scroll { scrollbar-width: none; }
.filterbar-scroll::-webkit-scrollbar { display: none; height: 0; width: 0; }
</style>

<script setup lang="ts">
import { ref, provide, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';
import Tooltip from './Tooltip.vue';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: String,
    required: false
  },
  orientation: {
    type: String,
    default: 'horizontal',
    validator: (value: string) => ['horizontal', 'vertical'].includes(value)
  },
  vertical: {
    type: Boolean,
    default: false
  },
  closable: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'tab-click', 'tab-close', 'change']);

const tabs = ref<Array<{ id: string, label: string, icon?: string }>>([]);
const activeTabId = ref(props.modelValue);

/** False from the moment this Tabs starts unmounting — see `unregister`. */
let isAlive = true;

const isVertical = computed(() => props.vertical || props.orientation === 'vertical');

const activeTabLabel = computed(() => {
  const tab = tabs.value.find(t => t.id === activeTabId.value);
  return tab ? tab.label : '';
});

provide('tabs-context', {
  activeTab: activeTabId,
  register: (id: string, label: string, icon?: string) => {
    if (!tabs.value.find(t => t.id === id)) {
      tabs.value.push({ id, label, icon });
    }
    if (!activeTabId.value) {
      activeTabId.value = id;
    }
  },
  unregister: (id: string) => {
    const index = tabs.value.findIndex(t => t.id === id);
    tabs.value = tabs.value.filter(t => t.id !== id);
    if (activeTabId.value !== id) return;
    // Deferred on purpose. On teardown EVERY tab unregisters in turn, and
    // picking a neighbour for each one walked the bound model tab by tab to the
    // last one and persisted it — reopening the Command Log always landed on
    // "Error". By nextTick a real teardown has emptied the list, so only the
    // genuine case (one tab removed while the others stay) reselects.
    nextTick(() => {
      if (!isAlive || activeTabId.value !== id || tabs.value.length === 0) return;
      selectTab(tabs.value[Math.max(0, index - 1)].id);
    });
  },
  update: (id: string, label: string, icon?: string) => {
    const tab = tabs.value.find(t => t.id === id);
    if (tab) {
      tab.label = label;
      tab.icon = icon;
    }
  }
});

watch(() => props.modelValue, (newVal) => {
  if (newVal !== undefined) {
    activeTabId.value = newVal;
  }
});

function selectTab(id: string) {
  activeTabId.value = id;
  emit('update:modelValue', id);
  emit('tab-click', id);
  emit('change', id);
}

function closeTab(id: string, event: Event) {
  event.stopPropagation();
  emit('tab-close', id);
}

/** Native div ref — no SimpleBar wrapper needed, just native scroll */
const scrollContainer = ref<HTMLElement | null>(null);

function scrollTabs(direction: 'left' | 'right') {
  if (scrollContainer.value) {
    scrollContainer.value.scrollBy({
      left: direction === 'left' ? -200 : 200,
      behavior: 'smooth'
    });
  }
}

/** Whether the horizontal tab strip actually overflows (controls scroll-arrow visibility). */
const isOverflowing = ref(false);
let resizeObs: ResizeObserver | null = null;

function checkOverflow() {
  const el = scrollContainer.value;
  if (!el || isVertical.value) { isOverflowing.value = false; return; }
  isOverflowing.value = el.scrollWidth > el.clientWidth + 2;
}

watch(tabs, () => nextTick(checkOverflow), { deep: true });

onMounted(() => {
  nextTick(checkOverflow);
  if (scrollContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => checkOverflow());
    resizeObs.observe(scrollContainer.value);
  }
});

onBeforeUnmount(() => {
  // Runs before the child Tabs unregister, so their teardown can tell a real
  // unmount from a single tab being removed.
  isAlive = false;
  resizeObs?.disconnect();
  resizeObs = null;
});
</script>

<template>
  <div :class="cn(
    'h-full w-full overflow-hidden flex',
    isVertical ? 'flex-row' : 'flex-col'
  )">
    <!-- Tabs Navigation -->
    <div :class="cn(
      'bg-surface border-line shrink-0 overflow-hidden relative flex flex-col',
      isVertical ? 'w-48 border-r h-full' : 'flex-row items-center h-9 border-b w-full'
    )">
      <!-- Sidebar Header (vertical mode only) -->
      <slot v-if="isVertical" name="sidebar-header" />

      <!-- Scroll Container for Tab buttons -->
      <div
        ref="scrollContainer"
        :class="cn(
          'overflow-hidden',
          isVertical ? 'w-full overflow-y-auto flex-1' : 'flex-1 overflow-x-auto tabs-scroll-x h-full'
        )"
      >
        <div :class="cn(
          isVertical ? 'flex flex-col w-full p-2 gap-1' : 'flex flex-row h-full items-end'
        )">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            @click="selectTab(tab.id)"
            :class="cn(
              'group cursor-pointer transition-colors shrink-0 select-none relative flex items-center gap-2',
              !isVertical
                ? 'h-8 px-4 text-xs rounded-t-md mx-[1px] border-b-2 border-transparent'
                : 'px-3 py-2 text-xs rounded-md w-full text-left',
              !isVertical && activeTabId === tab.id && 'bg-surface text-content-strong border-accent',
              !isVertical && activeTabId !== tab.id && 'bg-app text-content-muted hover:bg-surface-hover hover:text-content',
              isVertical && activeTabId === tab.id && 'bg-surface-hover text-content-strong font-bold border-line-strong shadow-sm shadow-black/20',
              isVertical && activeTabId !== tab.id && 'text-content-muted hover:bg-surface-hover'
            )"
          >
            <!-- Tab Icon -->
            <div v-if="tab.icon" class="flex-shrink-0 flex items-center justify-center w-4 h-4" :class="activeTabId === tab.id ? 'text-accent' : 'text-content-muted'">
              <Icon :icon="tab.icon" />
            </div>
            
            <span class="truncate">{{ tab.label }}</span>
            <Icon
              v-if="closable"
              icon="lucide:x"
              class="text-[10px] opacity-0 group-hover:opacity-100 hover:text-content-strong transition-all ml-1"
              @click="closeTab(tab.id, $event)"
            />

            <!-- Vertical Left Blue Indicator Bar -->
            <div v-if="isVertical && activeTabId === tab.id"
                 class="absolute left-0 top-1 bottom-1 w-1 bg-accent rounded-r-full">
            </div>
          </div>
        </div>

      </div>

      <!-- Horizontal right controls: grouped scroll arrows (on overflow) + actions slot (e.g. add/close) -->
      <div v-if="!isVertical" class="flex items-center h-full shrink-0 px-1 gap-0.5">
        <template v-if="isOverflowing">
          <Tooltip :text="t('ui.scroll_left')" position="bottom">
            <button @click="scrollTabs('left')"
                    class="h-7 w-6 flex items-center justify-center rounded text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors">
              <Icon icon="lucide:chevron-left" class="text-xs" />
            </button>
          </Tooltip>
          <Tooltip :text="t('ui.scroll_right')" position="bottom">
            <button @click="scrollTabs('right')"
                    class="h-7 w-6 flex items-center justify-center rounded text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors">
              <Icon icon="lucide:chevron-right" class="text-xs" />
            </button>
          </Tooltip>
        </template>
        <slot name="tab-actions" />
      </div>

      <!-- Sidebar Footer (vertical mode only) -->
      <slot v-if="isVertical" name="sidebar-footer" />
      <!-- Inline Sidebar Footer (horizontal mode only, if exists) -->
      <slot v-if="!isVertical" name="sidebar-footer" />
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0 overflow-hidden relative">
      <slot :activeTabLabel="activeTabLabel" :activeTab="activeTabId"></slot>
    </div>
  </div>
</template>

<style scoped>
/* Hidden scrollbar for horizontal tabs (scroll via arrows / wheel) */
.tabs-scroll-x {
  scrollbar-width: none;
}
.tabs-scroll-x::-webkit-scrollbar {
  display: none;
  height: 0;
  width: 0;
}
</style>

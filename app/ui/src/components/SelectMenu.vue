<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { cn } from '../utils/cn';

/**
 * A floating searchable menu component.
 * Typically used for repository or branch selection.
 */
interface MenuItem {
  label: string;
  sublabel?: string;
  action?: () => void;
  icon?: string;
  badge?: string;
  active?: boolean;
}

const props = defineProps<{
  /** X coordinate for floating position. */
  x: number;
  /** Y coordinate for floating position. */
  y: number;
  /** List of items to display in the menu. */
  items: MenuItem[];
  /** Search input placeholder. */
  placeholder?: string;
}>();

const emit = defineEmits<{
  /** Emitted when the menu should be closed. */
  (e: 'close'): void;
}>();

const { t } = useI18n();

const menuElement = ref<HTMLElement | null>(null);
const searchInput = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

/** Filtered items based on search query. */
const filteredItems = computed(() => {
  if (!searchInput.value) return props.items;
  const term = searchInput.value.toLowerCase();
  return props.items.filter(i =>
    i.label.toLowerCase().indexOf(term) !== -1 ||
    (i.sublabel && i.sublabel.toLowerCase().indexOf(term) !== -1)
  );
});

// --- Virtual scrolling ---------------------------------------------------
// Repos with hundreds of remote branches used to render every button at once,
// which made scrolling stutter. Render only the rows in view + a small overscan.
const VIEWPORT_H = 250; // matches the list's max-height
const OVERSCAN = 6;
// Rows are taller when a sublabel is shown. A menu's items are homogeneous
// (all branches, or all repos), so a single row height per menu is accurate.
const rowHeight = computed(() => (props.items.some(i => i.sublabel) ? 44 : 32));

const scroller = ref<HTMLElement | null>(null);
const scrollTop = ref(0);

const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - OVERSCAN));
const endIndex = computed(() => Math.min(
  filteredItems.value.length,
  Math.ceil((scrollTop.value + VIEWPORT_H) / rowHeight.value) + OVERSCAN
));
const visibleItems = computed(() => filteredItems.value.slice(startIndex.value, endIndex.value));

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop;
}

// Reset to the top whenever the result set changes so the window stays valid.
watch(searchInput, () => {
  scrollTop.value = 0;
  nextTick(() => { if (scroller.value) scroller.value.scrollTop = 0; });
});

/** Closes the menu if clicking outside of it. */
function onClickOutside(event: MouseEvent) {
  if (menuElement.value && !menuElement.value.contains(event.target as Node)) {
    emit('close');
  }
}

/** Handles items selection. */
function handleItemClick(item: MenuItem) {
  if (item.action) item.action();
  emit('close');
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  setTimeout(() => {
    if (inputRef.value) {
      inputRef.value.focus();
    }
  }, 50);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-50 pointer-events-auto" :style="{ top: y + 'px', left: x + 'px' }">
      <div ref="menuElement" class="bg-surface border border-line-strong w-[260px] rounded-lg shadow-2xl py-0 flex flex-col pointer-events-auto text-[#E0E0E0] text-xs overflow-hidden">
        
        <!-- Search Input -->
        <div class="p-2 border-b border-line-strong bg-surface">
          <div class="relative flex items-center">
            <Icon icon="lucide:search" class="absolute left-2.5 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            <input 
              ref="inputRef"
              v-model="searchInput" 
              type="text" 
              spellcheck="false"
              :placeholder="placeholder || t('common.search') || 'Search...'" 
              class="w-full bg-app border border-line-strong focus:border-accent rounded px-8 py-1.5 text-xs text-content outline-none transition-colors"
              @keydown.esc="emit('close')"
            />
          </div>
        </div>

        <!-- Item List (virtualized) -->
        <div ref="scroller" @scroll="onScroll" class="flex-1 p-1 overflow-y-auto select-menu-scroll" style="max-height: 250px;">
          <div v-if="filteredItems.length === 0" class="py-4 text-center text-neutral-500">
             {{ t('common.no_results') || 'No results found.' }}
          </div>
          <div v-else :style="{ height: filteredItems.length * rowHeight + 'px', position: 'relative' }">
            <div :style="{ transform: `translateY(${startIndex * rowHeight}px)`, position: 'absolute', top: 0, left: 0, right: 0 }">
              <button v-for="(item, index) in visibleItems" :key="startIndex + index"
                      @click="handleItemClick(item)"
                      :style="{ height: rowHeight + 'px' }"
                      :class="cn(
                        'h-stack justify-between px-2.5 w-full text-left cursor-pointer transition-colors duration-150 rounded-md group/item',
                        item.active
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                          : 'hover:bg-white/10 text-content hover:text-neutral-900 dark:hover:text-white'
                      )">

                <div class="h-stack gap-2.5 flex-1 min-w-0">
                  <span v-if="item.icon"
                        :class="cn(
                          'w-4 center text-center text-[12px] opacity-70 group-hover/item:opacity-100 transition-opacity',
                          item.active ? 'text-white opacity-100' : ''
                        )">
                    <Icon :icon="item.icon" />
                  </span>
                  <div class="v-stack min-w-0 gap-0.5">
                    <span class="text-xs truncate block font-medium leading-tight">{{ item.label }}</span>
                    <span v-if="item.sublabel"
                          :class="cn(
                            'text-[9px] truncate block leading-none opacity-50',
                            item.active ? 'text-blue-100 opacity-80' : 'text-neutral-500'
                          )">{{ item.sublabel }}</span>
                  </div>
                </div>

                <div class="h-stack gap-2 shrink-0">
                  <span v-if="item.badge"
                        :class="cn(
                          'px-1.5 py-0.5 rounded text-[9px] font-black tracking-tighter bg-black/30 border border-white/5 text-content-muted transition-colors',
                          item.active ? 'bg-white/20 border-white/20 text-white' : ''
                        )">
                    {{ item.badge }}
                  </span>
                  <div v-if="item.active" class="w-4 h-4 center scale-in-center">
                    <Icon icon="lucide:check" class="text-[14px] text-white" />
                  </div>
                </div>

              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

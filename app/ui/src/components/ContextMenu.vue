<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  x: number;
  y: number;
  items: Array<{
    label: string;
    action?: () => void;
    icon?: string;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    separator?: boolean;
    active?: boolean;
    checked?: boolean;
    subItems?: Array<any>;
  }>;
}>();

const emit = defineEmits(['close']);

const menuElement = ref<HTMLElement | null>(null);

// --- Viewport clamping ------------------------------------------------------
// Keep the menu on screen regardless of zoom: shift it left/up when it would
// overflow, and when it's taller than the viewport cap its height and scroll.
const MARGIN = 8;
const menuStyle = ref<Record<string, string>>({ top: props.y + 'px', left: props.x + 'px', visibility: 'hidden' });
const listMaxHeight = ref('');

function adjustPosition() {
  const el = menuElement.value;
  if (!el) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const h = el.scrollHeight;
  let left = props.x;
  let top = props.y;

  if (left + w > vw - MARGIN) left = Math.max(MARGIN, vw - w - MARGIN);
  if (left < MARGIN) left = MARGIN;

  const maxH = vh - MARGIN * 2;
  if (h > maxH) {
    top = MARGIN;
    listMaxHeight.value = maxH + 'px';
  } else {
    listMaxHeight.value = '';
    if (top + h > vh - MARGIN) top = Math.max(MARGIN, vh - h - MARGIN);
    if (top < MARGIN) top = MARGIN;
  }

  menuStyle.value = { top: top + 'px', left: left + 'px', visibility: 'visible' };
}

// --- JetBrains-style edge auto-scroll --------------------------------------
// When the menu is taller than the viewport, hovering near the top/bottom edge
// scrolls it so every item is reachable.
let scrollRAF: number | null = null;
let scrollDir = 0;

function autoScrollStep() {
  const el = menuElement.value;
  if (!el || scrollDir === 0) { scrollRAF = null; return; }
  el.scrollTop += scrollDir * 8;
  scrollRAF = requestAnimationFrame(autoScrollStep);
}

function onMenuMouseMove(e: MouseEvent) {
  const el = menuElement.value;
  if (!el || el.scrollHeight <= el.clientHeight) { scrollDir = 0; return; }
  const rect = el.getBoundingClientRect();
  const edge = 22;
  if (e.clientY < rect.top + edge) scrollDir = -1;
  else if (e.clientY > rect.bottom - edge) scrollDir = 1;
  else scrollDir = 0;
  if (scrollDir !== 0 && scrollRAF == null) scrollRAF = requestAnimationFrame(autoScrollStep);
}

function stopAutoScroll() {
  scrollDir = 0;
  if (scrollRAF != null) { cancelAnimationFrame(scrollRAF); scrollRAF = null; }
}

function onClickOutside(event: MouseEvent) {
  if (menuElement.value && !menuElement.value.contains(event.target as Node)) {
    emit('close');
  }
}

function handleItemClick(item: any) {
  if (item.disabled || item.separator) return;
  // A parent that has an action runs it (e.g. "Settings" opens the default tab);
  // a parent with only sub-items keeps the menu open so the submenu can be used.
  if (item.action) { item.action(); emit('close'); return; }
  if (item.subItems?.length) return;
  emit('close');
}

// Submenu hover-intent: a short close delay + an invisible bridge over the gap
// between the parent item and the submenu let the mouse travel diagonally
// without the submenu snapping shut.
const openSubIndex = ref<number | null>(null);
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function cancelClose() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
}

function openSub(index: number) {
  cancelClose();
  openSubIndex.value = index;
}

function scheduleClose() {
  cancelClose();
  closeTimer = setTimeout(() => { openSubIndex.value = null; closeTimer = null; }, 220);
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  window.addEventListener('resize', adjustPosition);
  nextTick(adjustPosition);
});

watch(() => [props.x, props.y, props.items], () => nextTick(adjustPosition));

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
  window.removeEventListener('resize', adjustPosition);
  stopAutoScroll();
  cancelClose();
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-50 pointer-events-auto" :style="menuStyle">
    <div ref="menuElement"
         class="context-menu-scroll bg-surface border border-line-strong min-w-[220px] rounded shadow-xl py-1 flex flex-col pointer-events-auto text-content text-xs"
         :style="{ maxHeight: listMaxHeight || 'none', overflowY: listMaxHeight ? 'auto' : 'visible' }"
         @mousemove="onMenuMouseMove"
         @mouseleave="stopAutoScroll">
      <template v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div v-if="item.separator" class="h-px bg-neutral-300 dark:bg-neutral-700 my-1 mx-2"></div>
        
        <!-- Menu Item -->
        <div v-else
             class="relative group"
             @mouseenter="openSub(index)"
             @mouseleave="scheduleClose()">
          <button @click="handleItemClick(item)"
                  class="flex items-center justify-between px-4 py-1.5 w-full text-left"
                  :class="[
                    item.disabled ? 'opacity-50 cursor-not-allowed text-neutral-500' : 'hover:bg-neutral-200 dark:hover:bg-[#4A4A4A] cursor-pointer text-content',
                    item.danger && !item.disabled ? 'text-red-400 hover:text-red-300' : ''
                  ]">
          <div class="flex items-center gap-2 flex-1">
            <span v-if="item.active || item.checked" class="w-4 text-center text-xs flex items-center justify-center text-blue-400">
              <Icon icon="lucide:check" />
            </span>
            <span v-else-if="item.icon" class="w-4 text-center text-sm flex items-center justify-center"><Icon :icon="item.icon" /></span>
            <span v-else class="w-4"></span>
            <span :class="{'font-medium': !item.disabled, 'text-blue-400': item.active || item.checked}">{{ item.label }}</span>
          </div>
          <div v-if="item.shortcut || item.subItems?.length" class="text-neutral-500 flex items-center gap-2">
            <span v-if="item.shortcut" class="whitespace-nowrap">{{ item.shortcut }}</span>
            <Icon v-if="item.subItems?.length" icon="lucide:chevron-right" class="text-content-muted" />
          </div>
          </button>
          
          <!-- Submenu (with an invisible hover bridge via pl-1 covering the gap) -->
          <div v-if="item.subItems?.length && openSubIndex === index"
               class="absolute left-full top-0 -mt-1 pl-1.5 pointer-events-auto z-50"
               @mouseenter="cancelClose()"
               @mouseleave="scheduleClose()">
            <div class="bg-surface border border-line-strong min-w-[220px] rounded shadow-xl py-1 flex flex-col text-content text-xs">
              <template v-for="(subItem, subIndex) in item.subItems" :key="'sub_'+subIndex">
                <div v-if="subItem.separator" class="h-px bg-neutral-300 dark:bg-neutral-700 my-1 mx-2"></div>
                <button v-else @click.stop="handleItemClick(subItem)"
                        class="flex items-center justify-between px-4 py-1.5 w-full text-left"
                        :class="[
                          subItem.disabled ? 'opacity-50 cursor-not-allowed text-neutral-500' : 'hover:bg-neutral-200 dark:hover:bg-[#4A4A4A] cursor-pointer text-content',
                          subItem.danger && !subItem.disabled ? 'text-red-400 hover:text-red-300' : ''
                        ]">
                  <div class="flex items-center gap-2 flex-1">
                    <span v-if="subItem.icon" class="w-4 text-center text-sm flex items-center justify-center"><Icon :icon="subItem.icon" /></span>
                    <span v-else class="w-4"></span>
                    <span :class="{'font-medium': !subItem.disabled}">{{ subItem.label }}</span>
                  </div>
                </button>
              </template>
            </div>
          </div>
        </div>
      </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu-scroll::-webkit-scrollbar { width: 8px; }
.context-menu-scroll::-webkit-scrollbar-thumb {
  background: rgba(120, 120, 120, 0.35);
  border-radius: 8px;
}
.context-menu-scroll::-webkit-scrollbar-thumb:hover { background: rgba(120, 120, 120, 0.55); }
.context-menu-scroll::-webkit-scrollbar-track { background: transparent; }
</style>

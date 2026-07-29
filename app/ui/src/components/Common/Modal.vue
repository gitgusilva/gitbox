<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';
import { contextMenu, isTopmostModal, popModal, pushModal } from '../../services/modalService';
import ScrollArea from './ScrollArea.vue';

interface Props {
  modelValue: boolean;
  title?: string;
  icon?: string;
  iconColor?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  hideCloseBtn?: boolean;
  /** When false, the body is a plain flex container (no scroll wrapper) so the
   *  slotted content can manage its own height/scrolling and fill the modal. */
  scrollBody?: boolean;
  /** When false, clicking the backdrop no longer closes the modal — for dialogs
   *  that demand an explicit choice (e.g. the credential prompt), so a stray
   *  click outside can't dismiss them and lose what the user was doing. */
  closeOnOverlay?: boolean;
  /** When false, the dialog stays pinned to the centre of the window instead of
   *  being draggable by its header. */
  draggable?: boolean;
  class?: string;
}

// Vue casts an ABSENT Boolean prop to `false`, so the opt-out flags below need
// explicit `true` defaults. Without them `scrollBody`/`closeOnOverlay` were
// false on every modal that didn't pass them: no body ever got the scroll
// wrapper and a backdrop click never closed anything.
const props = withDefaults(defineProps<Props>(), {
  scrollBody: true,
  closeOnOverlay: true,
  draggable: true,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}>();

function close() {
  emit('update:modelValue', false);
  emit('close');
}

// Keep the app-wide modal stack in sync. Counted once per instance (never twice,
// never left dangling when the component is torn down while open) — the title bar
// depends on it to stay usable, and Escape uses the order to find the top dialog.
const token = Symbol('modal');
let counted = false;
function setCounted(open: boolean) {
  if (open === counted) return;
  counted = open;
  if (open) pushModal(token); else popModal(token);
}
watch(() => props.modelValue, value => setCounted(!!value), { immediate: true });
onUnmounted(() => setCounted(false));

/**
 * Escape closes the dialog, matching the backdrop click — including while a
 * field inside it has focus, which is when the key is reached for most.
 *
 * Deliberately a local listener rather than a `registerShortcut`: that registry
 * fires every callback bound to a pattern, so all open dialogs would close at
 * once, and it drops un-modified keys while focus is in an input.
 */
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.modelValue) return;
  // Dialogs that refuse a stray backdrop click refuse a stray Escape too; each
  // of them offers an explicit Cancel, so nothing is trapped.
  if (!props.closeOnOverlay) return;
  // A context menu opened from inside the dialog takes the key first — closing
  // the dialog under it would leave the menu orphaned on screen.
  if (contextMenu.value) { contextMenu.value = null; e.preventDefault(); return; }
  if (!isTopmostModal(token)) return;
  e.preventDefault();
  e.stopPropagation();
  close();
}
document.addEventListener('keydown', onKeyDown);
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));

// --- Drag by the header, PrimeVue style -------------------------------------
// The dialog is centred by the overlay's flex box; dragging only adds a
// translation on top of that, always clamped so no edge can leave the window.
const dialogRef = ref<HTMLElement | null>(null);
const offset = ref({ x: 0, y: 0 });
const dragging = ref(false);
let start = { x: 0, y: 0, ox: 0, oy: 0 };

/**
 * A 2D translate, and only once the dialog has actually been dragged.
 *
 * This used to be an unconditional `translate3d(x, y, 0)`, which promoted every
 * dialog to its own GPU layer the moment it opened — including the ones nobody
 * ever drags — sitting under the overlay's `backdrop-filter`. That pairing is
 * where Chromium's compositing is least reliable, and a dialog that never moves
 * has nothing to gain from the layer. At rest it now carries no transform at all.
 */
const dragTransform = computed(() =>
  offset.value.x || offset.value.y
    ? `translate(${offset.value.x}px, ${offset.value.y}px)`
    : undefined,
);

/**
 * Where the dialog is allowed to sit. The title bar carries the window's drag
 * region and its minimize/maximize/close buttons, and it deliberately stacks
 * ABOVE the modal backdrop so it stays usable — so the dialog must stop at its
 * bottom edge instead of sliding underneath it.
 */
function safeArea() {
  const chrome = document.querySelector('[data-window-chrome]');
  return {
    top: chrome ? chrome.getBoundingClientRect().bottom : 0,
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
  };
}

/** Offset bounds that keep the dialog fully inside the safe area. */
function bounds() {
  const el = dialogRef.value;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const area = safeArea();
  // Un-translate the rect so the limits are relative to the centred position.
  const left = r.left - offset.value.x;
  const top = r.top - offset.value.y;
  return {
    minX: area.left - left,
    maxX: area.right - (left + r.width),
    minY: area.top - top,
    maxY: area.bottom - (top + r.height),
  };
}

function clampOffset() {
  const b = bounds();
  if (!b) return;
  // A dialog larger than the window has an inverted range; pin it to the top-left
  // edge rather than letting the clamp fight itself.
  offset.value = {
    x: Math.min(Math.max(offset.value.x, Math.min(b.minX, b.maxX)), Math.max(b.minX, b.maxX)),
    y: Math.min(Math.max(offset.value.y, Math.min(b.minY, b.maxY)), Math.max(b.minY, b.maxY)),
  };
}

function onHeaderMouseDown(e: MouseEvent) {
  if (!props.draggable || e.button !== 0) return;
  const target = e.target as HTMLElement | null;
  // Only the header — or anything a custom header opts in with `data-modal-drag`
  // — grabs the dialog, and never a click meant for a control inside it.
  if (!target?.closest('[data-modal-drag]')) return;
  if (target.closest('button, a, input, textarea, select, [contenteditable]')) return;
  dragging.value = true;
  start = { x: e.clientX, y: e.clientY, ox: offset.value.x, oy: offset.value.y };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function onDragMove(e: MouseEvent) {
  const b = bounds();
  if (!b) return;
  const x = start.ox + (e.clientX - start.x);
  const y = start.oy + (e.clientY - start.y);
  offset.value = {
    x: Math.min(Math.max(x, Math.min(b.minX, b.maxX)), Math.max(b.minX, b.maxX)),
    y: Math.min(Math.max(y, Math.min(b.minY, b.maxY)), Math.max(b.minY, b.maxY)),
  };
}

function onDragEnd() {
  dragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.body.style.userSelect = '';
}

// Re-centre every time the dialog opens, and keep it on screen when the window
// (or the dialog's own content) changes size.
watch(() => props.modelValue, open => {
  if (open) offset.value = { x: 0, y: 0 };
  else onDragEnd();
});

function onWindowResize() {
  if (props.modelValue) clampOffset();
}
window.addEventListener('resize', onWindowResize);
onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  onDragEnd();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue"
         class="fixed inset-0 z-[100] center bg-black/55 backdrop-blur-[6px] animate-in fade-in duration-200"
         @click.self="closeOnOverlay && close()">
      <div ref="dialogRef"
           :class="cn(
            'bg-app border border-line rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden scale-in-center v-stack',
            height ? '' : 'h-min',
            props.class
           )"
           :style="{
             width: width || '600px',
             height: height,
             minWidth: minWidth,
             minHeight: minHeight,
             maxHeight: maxHeight || '90vh',
             transform: dragTransform
           }"
           @mousedown="onHeaderMouseDown">

        <!-- Header slot or Default Header — also the drag handle -->
        <div class="shrink-0 min-w-0" data-modal-drag
             :class="draggable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''">
          <slot name="header">
            <header v-if="title" class="h-14 border-b border-line h-stack justify-between px-6 bg-surface">
              <div class="h-stack gap-2.5">
                <Icon v-if="icon" :icon="icon" :class="cn(iconColor || 'text-accent', 'text-lg')" />
                <h1 class="font-bold text-sm text-content tracking-tight">
                  {{ title }}
                </h1>
              </div>
              <button v-if="!hideCloseBtn" @click="close" class="w-8 h-8 center rounded-lg hover:bg-white/5 text-content-muted hover:text-content-strong transition-all cursor-pointer">
                <Icon icon="lucide:x" class="text-lg" />
              </button>
            </header>
          </slot>
        </div>

        <!-- Body -->
        <ScrollArea v-if="scrollBody" class="flex-1 v-stack min-h-0 min-w-0">
            <slot />
        </ScrollArea>
        <div v-else class="flex-1 v-stack min-h-0 min-w-0 overflow-hidden">
            <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" class="shrink-0 border-t border-line px-6 py-4 bg-app">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scale-in-center {
  animation: scale-in-center 0.2s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
}

/* Animates the individual `scale` property, not `transform`, so the drag
   translation on the same element isn't overwritten by the animation. */
@keyframes scale-in-center {
  0% { scale: 0.95; opacity: 0; }
  100% { scale: 1; opacity: 1; }
}
</style>

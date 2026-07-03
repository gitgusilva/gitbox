<script setup lang="ts">
/**
 * iOS-style color picker: a swatch trigger opening a popover with a
 * saturation/value square, a hue slider, a hex field and preset swatches.
 * Emits a #RRGGBB string. Alpha is intentionally omitted (theme tokens are
 * solid; transparency is handled via Tailwind's /opacity modifier).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const PRESETS = [
  '#1E1E1E', '#252526', '#2D2D2D', '#6B7280', '#CCCCCC', '#FFFFFF',
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4',
  '#3B82F6', '#2563EB', '#6366F1', '#A855F7', '#EC4899', '#F43F5E',
];

const open = ref(false);
const trigger = ref<HTMLElement | null>(null);
const popover = ref<HTMLElement | null>(null);
const popStyle = ref<Record<string, string>>({ visibility: 'hidden' });

// HSV model (h: 0..360, s/v: 0..1)
const h = ref(0);
const s = ref(0);
const v = ref(0);
const hexText = ref('');
let suppressWatch = false;

function clamp(n: number, min = 0, max = 1) { return Math.min(max, Math.max(min, n)); }

function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(hue: number, sat: number, val: number): [number, number, number] {
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let r = 0, g = 0, b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const currentHex = computed(() => rgbToHex(...hsvToRgb(h.value, s.value, v.value)));
const hueColor = computed(() => rgbToHex(...hsvToRgb(h.value, 1, 1)));

function syncFromHex(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [hh, ss, vv] = rgbToHsv(...rgb);
  // Keep the hue when the color is greyscale (s or v = 0) to avoid the handle jumping.
  if (ss > 0) h.value = hh;
  s.value = ss;
  v.value = vv;
  hexText.value = hex.toUpperCase();
}

syncFromHex(props.modelValue);
watch(() => props.modelValue, (val) => { if (!suppressWatch) syncFromHex(val); });

function emitColor() {
  suppressWatch = true;
  hexText.value = currentHex.value;
  emit('update:modelValue', currentHex.value);
  nextTick(() => { suppressWatch = false; });
}

function onHexInput(e: Event) {
  let val = (e.target as HTMLInputElement).value.trim();
  if (!val.startsWith('#')) val = `#${val}`;
  if (hexToRgb(val)) { syncFromHex(val); emitColor(); }
}

// --- Drag interactions ------------------------------------------------------

function dragOn(el: HTMLElement | null, handler: (px: number, py: number) => void) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const move = (ev: PointerEvent) => {
    handler(clamp((ev.clientX - rect.left) / rect.width), clamp((ev.clientY - rect.top) / rect.height));
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  return move;
}

const svArea = ref<HTMLElement | null>(null);
function onSvDown(e: PointerEvent) {
  const move = dragOn(svArea.value, (px, py) => { s.value = px; v.value = 1 - py; emitColor(); });
  move?.(e);
}

const hueArea = ref<HTMLElement | null>(null);
function onHueDown(e: PointerEvent) {
  const move = dragOn(hueArea.value, (px) => { h.value = px * 360; emitColor(); });
  move?.(e);
}

function pickPreset(hex: string) { syncFromHex(hex); emitColor(); }

// --- Popover open/close + positioning --------------------------------------

function position() {
  const t = trigger.value;
  const p = popover.value;
  if (!t || !p) return;
  const r = t.getBoundingClientRect();
  const w = p.offsetWidth, ph = p.offsetHeight;
  const margin = 8;
  let left = r.left;
  let top = r.bottom + 6;
  if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
  if (top + ph > window.innerHeight - margin) top = r.top - ph - 6;
  popStyle.value = { left: `${Math.max(margin, left)}px`, top: `${Math.max(margin, top)}px`, visibility: 'visible' };
}

function toggle() {
  open.value = !open.value;
  if (open.value) { popStyle.value = { visibility: 'hidden' }; nextTick(position); }
}

function onDocPointer(e: PointerEvent) {
  const target = e.target as Node;
  if (popover.value?.contains(target) || trigger.value?.contains(target)) return;
  open.value = false;
}

onMounted(() => document.addEventListener('pointerdown', onDocPointer));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer));
</script>

<template>
  <div class="inline-flex">
    <button
      ref="trigger"
      type="button"
      @click="toggle"
      class="flex items-center gap-2 h-7 pl-1 pr-2 rounded-lg border border-line-strong bg-app hover:border-accent transition-colors"
    >
      <span class="w-5 h-5 rounded-md border border-black/10 dark:border-white/15 shadow-inner" :style="{ background: currentHex }" />
      <span class="text-[10px] font-mono text-content-muted tracking-tight">{{ currentHex }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="popover"
        class="fixed z-[200] w-[236px] p-3 rounded-2xl border border-line bg-overlay shadow-[0_16px_40px_rgba(0,0,0,0.4)] flex flex-col gap-3 select-none"
        :style="popStyle"
      >
        <!-- Saturation / Value square -->
        <div
          ref="svArea"
          @pointerdown="onSvDown"
          class="relative w-full h-36 rounded-xl cursor-crosshair overflow-hidden touch-none"
          :style="{ background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, ${hueColor})` }"
        >
          <span
            class="absolute w-3.5 h-3.5 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow ring-1 ring-black/30 pointer-events-none"
            :style="{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: currentHex }"
          />
        </div>

        <!-- Hue slider -->
        <div
          ref="hueArea"
          @pointerdown="onHueDown"
          class="relative w-full h-3.5 rounded-full cursor-pointer touch-none"
          style="background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
        >
          <span
            class="absolute top-1/2 w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow ring-1 ring-black/30 pointer-events-none"
            :style="{ left: `${(h / 360) * 100}%`, background: hueColor }"
          />
        </div>

        <!-- Hex field -->
        <div class="flex items-center gap-2">
          <span class="w-7 h-7 rounded-lg border border-line shrink-0" :style="{ background: currentHex }" />
          <input
            :value="hexText"
            @input="onHexInput"
            spellcheck="false"
            class="flex-1 min-w-0 h-7 px-2 rounded-lg border border-line-strong bg-app text-content text-[11px] font-mono uppercase focus:outline-none focus:border-accent"
          />
        </div>

        <!-- Presets -->
        <div class="grid grid-cols-9 gap-1.5">
          <button
            v-for="p in PRESETS"
            :key="p"
            type="button"
            @click="pickPreset(p)"
            class="w-full aspect-square rounded-md border border-black/10 dark:border-white/15 hover:scale-110 transition-transform"
            :style="{ background: p }"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

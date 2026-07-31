<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import IconButton from './IconButton.vue';
import { humanBytes } from '../../utils/formatters';

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
}>();

const { t } = useI18n();

function getMimeType(filename: string) {
    if (!filename) return 'image/png';
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'ico': return 'image/x-icon';
        case 'svg': return 'image/svg+xml';
        default: return 'image/png';
    }
}

const srcOriginal = computed(() => {
    if (!props.original) return '';
    if (props.original.startsWith('data:')) return props.original;
    const mime = getMimeType(props.filename || '');
    return `data:${mime};base64,${props.original}`;
});

const srcModified = computed(() => {
    if (!props.modified) return '';
    if (props.modified.startsWith('data:')) return props.modified;
    const mime = getMimeType(props.filename || '');
    return `data:${mime};base64,${props.modified}`;
});

// Zoom -----------------------------------------------------------------
// 'fit' scales the image down to the pane and is the default: assets are
// commonly @2x, so rendering at natural size (the old behaviour) showed a
// cropped corner of a 1440x920 PNG inside a ~400px pane. Numeric values are
// explicit scale factors for pixel-level inspection.
const ZOOM_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const zoom = ref<'fit' | number>('fit');

const isFit = computed(() => zoom.value === 'fit');

const sizeOriginal = ref<{ w: number; h: number } | null>(null);
const sizeModified = ref<{ w: number; h: number } | null>(null);

// The zoom percentage only has a meaning once an image is measured; in fit
// mode we report the effective scale of whichever side is on screen.
const fitScale = ref(1);

const zoomLabel = computed(() => {
    const scale = isFit.value ? fitScale.value : (zoom.value as number);
    return `${Math.round(scale * 100)}%`;
});

function onLoad(e: Event, side: 'original' | 'modified') {
    const img = e.target as HTMLImageElement;
    const size = { w: img.naturalWidth, h: img.naturalHeight };
    if (side === 'original') sizeOriginal.value = size;
    else sizeModified.value = size;
    measureFit();
}

// Fit mode letterboxes through object-contain, so the real scale is the ratio
// between the rendered box and the natural size.
function measureFit() {
    if (!isFit.value) return;
    const img = (imgModified.value || imgOriginal.value) as HTMLImageElement | null;
    if (!img || !img.naturalWidth) return;
    fitScale.value = Math.min(1, img.clientWidth / img.naturalWidth);
}

function setZoom(next: 'fit' | number) {
    zoom.value = next;
    if (next === 'fit') requestAnimationFrame(measureFit);
}

function stepZoom(dir: 1 | -1) {
    const current = isFit.value ? fitScale.value : (zoom.value as number);
    // ZOOM_STEPS is ascending, so zooming out walks it from the top. (An index
    // scan rather than findLast, which the project's ES2020 lib target lacks.)
    let next: number | undefined;
    if (dir > 0) {
        next = ZOOM_STEPS.find(step => step > current + 0.001);
    } else {
        for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
            if (ZOOM_STEPS[i] < current - 0.001) {
                next = ZOOM_STEPS[i];
                break;
            }
        }
    }
    if (next) setZoom(next);
}

// Ctrl+wheel zooms (the usual image-viewer gesture); a plain wheel keeps
// scrolling the pane so a zoomed-in image stays navigable.
function onWheel(e: WheelEvent) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 1 : -1);
}

function styleFor(size: { w: number; h: number } | null) {
    if (isFit.value || !size) return undefined;
    const scale = zoom.value as number;
    return {
        width: `${size.w * scale}px`,
        height: `${size.h * scale}px`,
        maxWidth: 'none',
        maxHeight: 'none',
        imageRendering: scale > 1 ? ('pixelated' as const) : ('auto' as const),
    };
}

// Base64 payloads carry their own byte count, so the size badge costs nothing.
function byteLength(payload: string) {
    if (!payload) return 0;
    const raw = payload.startsWith('data:') ? payload.slice(payload.indexOf(',') + 1) : payload;
    const padding = raw.endsWith('==') ? 2 : raw.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
}

function badge(size: { w: number; h: number } | null, payload: string) {
    const dims = size ? `${size.w} × ${size.h}` : '';
    const weight = humanBytes(byteLength(payload));
    return dims ? `${dims} · ${weight}` : weight;
}

// A new file resets the view: keeping a 4x zoom across files made the next
// image open scrolled into a random corner.
watch(() => props.filename, () => {
    zoom.value = 'fit';
    fitScale.value = 1;
    sizeOriginal.value = null;
    sizeModified.value = null;
});

const imgOriginal = ref<HTMLImageElement | null>(null);
const imgModified = ref<HTMLImageElement | null>(null);

const leftPane = ref<HTMLElement | null>(null);
const rightPane = ref<HTMLElement | null>(null);

let isSyncingLeft = false;
let isSyncingRight = false;

// Both axes are synced: a zoomed-in image overflows horizontally too, and
// scrolling only one pane made the two versions impossible to compare.
function syncScroll(from: HTMLElement, to: HTMLElement) {
    const scrollableY = from.scrollHeight - from.clientHeight;
    const scrollableX = from.scrollWidth - from.clientWidth;

    if (scrollableY > 0) {
        const targetY = to.scrollHeight - to.clientHeight;
        to.scrollTop = (from.scrollTop / scrollableY) * targetY;
    }
    if (scrollableX > 0) {
        const targetX = to.scrollWidth - to.clientWidth;
        to.scrollLeft = (from.scrollLeft / scrollableX) * targetX;
    }
}

function onScrollLeft() {
    if (isSyncingLeft) {
        isSyncingLeft = false;
        return;
    }
    if (!leftPane.value || !rightPane.value) return;
    isSyncingRight = true;
    syncScroll(leftPane.value, rightPane.value);
}

function onScrollRight() {
    if (isSyncingRight) {
        isSyncingRight = false;
        return;
    }
    if (!leftPane.value || !rightPane.value) return;
    isSyncingLeft = true;
    syncScroll(rightPane.value, leftPane.value);
}
</script>

<template>
    <div class="flex-1 v-stack min-h-0 min-w-0 bg-app border-t border-line">
        <!-- Zoom controls: fit is the default, 1:1 and the steps are there for
             pixel-level inspection. -->
        <div class="shrink-0 h-9 h-stack items-center justify-center gap-1 px-2 border-b border-line bg-surface select-none">
            <IconButton direction="row"
                        :showLabel="false"
                        icon="lucide:zoom-out"
                        :label="t('diff.zoom_out')"
                        @click="stepZoom(-1)" />

            <span class="text-[10px] font-bold text-content-muted uppercase tracking-widest tabular-nums w-12 text-center">
                {{ zoomLabel }}
            </span>

            <IconButton direction="row"
                        :showLabel="false"
                        icon="lucide:zoom-in"
                        :label="t('diff.zoom_in')"
                        @click="stepZoom(1)" />

            <div class="w-px h-3 bg-surface-hover mx-1"></div>

            <IconButton direction="row"
                        :showLabel="false"
                        icon="lucide:maximize"
                        :label="t('diff.zoom_fit')"
                        :active="isFit"
                        @click="setZoom('fit')" />

            <IconButton direction="row"
                        :showLabel="false"
                        icon="lucide:scan"
                        :label="t('diff.zoom_actual')"
                        :active="zoom === 1"
                        @click="setZoom(1)" />
        </div>

        <!-- Each pane is a positioned wrapper around an inset-0 scroller: the
             scroller then has a definite height, which is what makes the
             image's `max-h-full` resolve, and the size badge can sit outside it
             so it does not scroll away when the image is zoomed in.
             `m-auto` (not justify/items-center) centers the image while keeping
             an overflowing one reachable in both directions — centered flex
             content clips its start edge out of scroll range. -->
        <div class="flex-1 h-stack min-h-0 min-w-0 gap-px bg-line">
            <div class="w-1/2 min-w-0 h-full relative">
                <div ref="leftPane"
                     @scroll="onScrollLeft"
                     @wheel="onWheel"
                     class="absolute inset-0 flex overflow-auto p-4 bg-app checkerboard">
                    <img v-if="props.original"
                         ref="imgOriginal"
                         :src="srcOriginal"
                         :style="styleFor(sizeOriginal)"
                         @load="onLoad($event, 'original')"
                         class="m-auto max-w-full max-h-full object-contain shadow-lg outline outline-1 outline-line-strong" />
                    <div v-else class="m-auto v-stack items-center gap-2 text-content-muted">
                        <Icon icon="lucide:file-plus-2" class="text-xl opacity-60" />
                        <span class="font-bold uppercase tracking-widest text-[10px]">{{ t('common.file_not_in_parent') }}</span>
                    </div>
                </div>

                <div v-if="props.original"
                     class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-overlay/90 border border-line text-[10px] font-mono text-content-muted whitespace-nowrap pointer-events-none">
                    {{ badge(sizeOriginal, props.original) }}
                </div>
            </div>

            <div class="w-1/2 min-w-0 h-full relative">
                <div ref="rightPane"
                     @scroll="onScrollRight"
                     @wheel="onWheel"
                     class="absolute inset-0 flex overflow-auto p-4 bg-app checkerboard">
                    <img v-if="props.modified"
                         ref="imgModified"
                         :src="srcModified"
                         :style="styleFor(sizeModified)"
                         @load="onLoad($event, 'modified')"
                         class="m-auto max-w-full max-h-full object-contain shadow-lg outline outline-1 outline-line-strong" />
                    <div v-else class="m-auto v-stack items-center gap-2 text-content-muted">
                        <Icon icon="lucide:file-x-2" class="text-xl opacity-60" />
                        <span class="font-bold uppercase tracking-widest text-[10px]">{{ t('common.file_deleted') }}</span>
                    </div>
                </div>

                <div v-if="props.modified"
                     class="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-overlay/90 border border-line text-[10px] font-mono text-content-muted whitespace-nowrap pointer-events-none">
                    {{ badge(sizeModified, props.modified) }}
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Token-driven so the transparency grid reads correctly on light themes too
   (it used to be hardcoded #222, invisible on light backgrounds). */
.checkerboard {
    background-image: linear-gradient(45deg, rgb(var(--gb-text-muted) / 0.12) 25%, transparent 25%),
                      linear-gradient(-45deg, rgb(var(--gb-text-muted) / 0.12) 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, rgb(var(--gb-text-muted) / 0.12) 75%),
                      linear-gradient(-45deg, transparent 75%, rgb(var(--gb-text-muted) / 0.12) 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
</style>

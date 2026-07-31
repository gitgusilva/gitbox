<script setup lang="ts">
import { computed, Ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Tooltip from './Tooltip.vue';
import Resizer from './Resizer.vue';
import type { DetailsOrientation } from '../../services/layoutService';

/**
 * A panel docked to the right of, or below, its content, floating above it
 * rather than squeezing it — content with its own multi-column layout reflows
 * badly into the leftover space. Owns the resizer placement, the dock-side
 * toggle and the close button so every docked surface behaves identically;
 * callers supply a header and the content, and must position themselves
 * `relative`.
 */
const props = withDefaults(defineProps<{
    /** Shared with the other docked panels so they all sit on the same side. */
    orientation: DetailsOrientation;
    /** Panel size per side; persisted by the caller through layoutService. */
    widthTarget: Ref<number>;
    heightTarget: Ref<number>;
    /** Drag limits, matching whatever the caller registered with persistedSize. */
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
}>(), {
    minWidth: 320,
    maxWidth: 1400,
    minHeight: 200,
    maxHeight: 1200,
});

const emit = defineEmits<{
    (e: 'update:orientation', value: DetailsOrientation): void;
    (e: 'close'): void;
}>();

const { t } = useI18n();

const isBottom = computed(() => props.orientation === 'bottom');

function toggleOrientation() {
    emit('update:orientation', isBottom.value ? 'right' : 'bottom');
}
</script>

<template>
    <div class="absolute z-40 flex flex-col min-h-0 min-w-0 bg-app border-line shadow-2xl"
         :class="isBottom ? 'border-t left-0 right-0 bottom-0' : 'border-l top-0 bottom-0 right-0'"
         :style="isBottom ? { height: heightTarget.value + 'px' } : { width: widthTarget.value + 'px' }">
        <Resizer v-if="isBottom"
                 vertical
                 :target="heightTarget"
                 :options="{ axis: 'y', invert: true, min: minHeight, max: maxHeight, clampToContainer: true, reserve: 160 }"
                 class="absolute top-0 left-0 right-0 -translate-y-1/2 z-30" />
        <Resizer v-else
                 :target="widthTarget"
                 :options="{ invert: true, min: minWidth, max: maxWidth, clampToContainer: true, reserve: 260 }"
                 class="absolute left-0 top-0 bottom-0 -translate-x-1/2 z-30" />

        <header class="shrink-0 h-[42px] px-3 flex items-center gap-2 border-b border-line bg-surface">
            <slot name="header" />

            <Tooltip :text="isBottom ? t('layout.dock_right') : t('layout.dock_bottom')" position="left">
                <button @click="toggleOrientation"
                        class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-content-muted hover:text-content-strong transition-colors">
                    <Icon :icon="isBottom ? 'lucide:panel-right' : 'lucide:panel-bottom'" />
                </button>
            </Tooltip>
            <Tooltip :text="t('view.close')" position="left">
                <button @click="emit('close')"
                        class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-content-muted hover:text-content-strong transition-colors">
                    <Icon icon="lucide:x" />
                </button>
            </Tooltip>
        </header>

        <div class="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
            <slot />
        </div>
    </div>
</template>

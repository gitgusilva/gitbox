<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Tooltip from './Tooltip.vue';
import { isTopmostModal, popModal, pushModal } from '../../services/modalService';
import { openExternalUrl } from '../../utils/formatters';

/**
 * Full-screen viewer for a single image. Any surface that renders images too
 * small to read — a PR description, a comment, release notes — can hand one
 * over with `v-model` and get Escape/backdrop dismissal and zoom for free.
 */
const props = defineProps<{
    /** The image to show; null keeps the overlay closed. */
    modelValue: string | null;
    /** Shown above the image (a filename, an alt text). */
    caption?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string | null): void }>();

const { t } = useI18n();

const isZoomed = ref(false);

function close() {
    emit('update:modelValue', null);
}

// Registered in the shared modal stack so Escape closes only the topmost
// surface: a lightbox opened from inside a dialog must not close both.
const token = Symbol('lightbox');

function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !isTopmostModal(token)) return;
    e.preventDefault();
    e.stopPropagation();
    close();
}

watch(() => props.modelValue, (value) => {
    isZoomed.value = false;
    if (value) {
        pushModal(token);
        document.addEventListener('keydown', onKeydown);
    } else {
        popModal(token);
        document.removeEventListener('keydown', onKeydown);
    }
}, { immediate: true });

onBeforeUnmount(() => {
    popModal(token);
    document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
    <!-- Teleported to the body like every other overlay: rendered in place it is
         trapped in its host's stacking context. z-[100] matches Modal.vue, which
         keeps it BELOW the window chrome the toolbar lifts to z-[120] — the drag
         region and the min/max/close buttons stay reachable, and the toolbar
         paints its own veil so the strip still reads as part of the backdrop.
         The controls live at the bottom for the same reason: up in the corner
         they collided with the window buttons. -->
    <Teleport to="body">
        <div v-if="modelValue"
             class="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[6px] flex flex-col animate-in fade-in duration-150"
             @click="close">
            <div class="flex-1 min-h-0 overflow-auto flex p-6 pb-2"
                 :class="isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'">
                <img :src="modelValue"
                     :alt="caption || ''"
                     :class="isZoomed ? 'max-w-none max-h-none m-auto' : 'max-w-full max-h-full object-contain m-auto'"
                     class="shadow-2xl rounded"
                     @click.stop="isZoomed = !isZoomed" />
            </div>

            <!-- One bar: what the image is on the left, what you can do on the
                 right, clear of every window control. -->
            <div class="shrink-0 flex justify-center p-4 pt-2" @click.stop>
                <div class="flex items-center gap-1 max-w-full rounded-xl border border-line-strong bg-surface/95 shadow-2xl px-2 py-1.5">
                    <span v-if="caption"
                          class="px-2 text-[11px] font-mono text-content-muted truncate max-w-[45vw]">{{ caption }}</span>
                    <div v-if="caption" class="w-px h-4 bg-line-strong mx-1 shrink-0"></div>

                    <Tooltip :text="isZoomed ? t('diff.zoom_fit') : t('diff.zoom_actual')" position="top">
                        <button @click="isZoomed = !isZoomed"
                                class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover text-content-muted hover:text-content-strong transition-colors">
                            <Icon :icon="isZoomed ? 'lucide:maximize' : 'lucide:scan'" />
                        </button>
                    </Tooltip>
                    <Tooltip :text="t('view.open_in_browser')" position="top">
                        <button @click="openExternalUrl(modelValue)"
                                class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover text-content-muted hover:text-content-strong transition-colors">
                            <Icon icon="lucide:external-link" />
                        </button>
                    </Tooltip>
                    <Tooltip :text="t('view.close')" position="top">
                        <button @click="close"
                                class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-removed hover:text-removed-fg text-content-muted transition-colors">
                            <Icon icon="lucide:x" />
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    </Teleport>
</template>

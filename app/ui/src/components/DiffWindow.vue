<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../services/themeService';
import type { DiffWindowMessage, DiffWindowState } from '../types/git';
import DiffViewer from './Common/DiffViewer.vue';
import DiffFileHeader from './Common/DiffFileHeader.vue';
import Tooltip from './Common/Tooltip.vue';
import WindowControls from './Common/WindowControls.vue';

/**
 * The diff viewer, detached into its own window. It holds no state: the window
 * that detached it pushes each file in and receives navigation / re-attach
 * requests back, so both sides always show the same thing.
 */
const { t } = useI18n();
const { currentTheme, applyTheme } = useTheme();

const state = ref<DiffWindowState>({ file: null, original: '', modified: '', index: 0, total: 0 });

function send(message: DiffWindowMessage) {
    window.gitbox.sendDiffWindowMessage(message);
}

let stopListening: (() => void) | undefined;

onMounted(() => {
    // Every window root paints itself with the active theme on load; the
    // module-level watcher only covers changes made afterwards.
    applyTheme(currentTheme.value);

    stopListening = window.gitbox.onDiffWindowMessage((message) => {
        if (message.type === 'state') state.value = message.payload;
    });
    // Ask for the current file: the window may open before the sender is ready.
    send({ type: 'ready' });
});

onBeforeUnmount(() => stopListening?.());

const title = computed(() => t('diff.diff_viewer'));

// The taskbar entry has to say what this window is before saying which file it
// is showing — "theme.json" alone is meaningless next to the main window.
watch(() => state.value.file?.path, (path) => {
    document.title = path ? `GitBox — ${title.value} — ${path}` : `GitBox — ${title.value}`;
}, { immediate: true });

function step(direction: 1 | -1) {
    send({ type: 'navigate', direction });
}

function attach() {
    console.warn('[dbg child attach] chamado', new Error().stack);
    send({ type: 'attach' });
}
</script>

<template>
    <div class="h-screen w-screen flex flex-col bg-app text-content overflow-hidden">
        <!-- Draggable strip: this window hides the native title bar. -->
        <header class="shrink-0 h-11 pl-3 flex items-center gap-2 border-b border-line bg-surface select-none"
                style="-webkit-app-region: drag">
            <div class="flex items-center gap-2 min-w-0 flex-1" style="-webkit-app-region: no-drag">
                <Icon icon="lucide:file-diff" class="text-accent shrink-0" />
                <span class="text-[11px] font-bold uppercase tracking-widest text-content-muted shrink-0">
                    {{ title }}
                </span>

                <template v-if="state.file">
                    <span class="text-content-muted shrink-0">·</span>
                    <DiffFileHeader :file="state.file"
                                    :index="state.index"
                                    :total="state.total"
                                    @step="step" />
                </template>
            </div>

            <div class="flex items-center gap-1 shrink-0" style="-webkit-app-region: no-drag">
                <span v-if="state.context" class="text-[10px] text-content-muted truncate max-w-[280px]">{{ state.context }}</span>
                <Tooltip :text="t('diff.attach')" position="left">
                    <button @click="attach"
                            class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-content-muted hover:text-content-strong">
                        <Icon icon="lucide:picture-in-picture-2" />
                    </button>
                </Tooltip>
            </div>

            <WindowControls />
        </header>

        <div v-if="state.isLoading" class="flex-1 flex items-center justify-center text-content-muted">
            <Icon icon="lucide:loader-2" class="animate-spin text-xl" />
        </div>
        <div v-else-if="state.error" class="flex-1 flex items-center justify-center text-xs text-content-muted px-6 text-center">
            {{ state.error }}
        </div>
        <div v-else-if="!state.file" class="flex-1 flex items-center justify-center text-xs text-content-muted">
            {{ t('diff.no_file_detached') }}
        </div>
        <DiffViewer v-else
                    :key="state.file.path"
                    :original="state.original"
                    :modified="state.modified"
                    :filename="state.file.path"
                    :read-only="true"
                    hide-filename
                    class="flex-1 min-h-0" />
    </div>
</template>

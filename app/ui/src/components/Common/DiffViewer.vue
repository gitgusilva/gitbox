<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';
import { getItem, setItem } from '../../services/storageService';
import ImageDiffViewer from './ImageDiffViewer.vue';
import MarkdownDiffViewer from './MarkdownDiffViewer.vue';
import IconButton from './IconButton.vue';
import Tooltip from './Tooltip.vue';
import Resizer from './Resizer.vue';
import { generalSettings } from '../../services/settingsService';
import { repoPath } from '../../services/gitService';
import { blameWidth, layoutRefs, isResizing } from '../../services/layoutService';
import { gravatarUrl } from '../../utils/avatars';
import { cn } from '../../utils/cn';
import { startMarquee, stopMarquee } from '../../utils/dom';

const { t } = useI18n();
const { currentTheme } = useTheme();

const displayLabels = computed(() => !generalSettings.value.hideIconLabels);

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
  readOnly?: boolean;
  inline?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modified', value: string): void;
  (e: 'save', value: string): void;
}>();

const container = ref<HTMLElement | null>(null);
const isHunkView = ref(getItem('gitbox_diff_hunk_view') === 'true');
const renderSideBySide = ref(props.inline ? false : (getItem('gitbox_diff_render_mode') !== 'inline'));
const viewType = ref<'diff' | 'file'>('diff');
const isWordWrap = ref(false);
const ignoreWhitespace = ref(false);
const isBlameVisible = ref(false);
const blameData = ref<any[]>([]);
const isBlameLoading = ref(false);
const visibleBlame = ref<any[]>([]);
const blameScrollTop = ref(0);
const blameError = ref<string | null>(null);

// O(1) line -> blame lookup, rebuilt when blame data changes. Avoids the
// O(visibleLines × totalLines) array scans updateVisibleBlame did per scroll frame.
let blameByLine = new Map<number, any>();
function rebuildBlameIndex() {
    blameByLine = new Map();
    for (const b of (blameData.value || [])) blameByLine.set(b.line, b);
}

async function loadBlame() {
    blameError.value = null;

    if (isBlameVisible.value && props.filename && viewType.value === 'file') {
        isBlameLoading.value = true;

        try {
            blameData.value = await (window as any).gitbox.getFileBlame(repoPath.value, props.filename);
            if (blameData.value === null || blameData.value.length === 0) {
                 blameError.value = 'No blame data available (file might be untracked).';
            }
        } catch (e: any) {
            console.error('[Blame] Error:', e);
            blameError.value = e.message || String(e);
            blameData.value = [];
        } finally {
            isBlameLoading.value = false;
            rebuildBlameIndex();
            updateVisibleBlame();
        }
    } else {
        blameData.value = [];
        rebuildBlameIndex();
        visibleBlame.value = [];
        blameError.value = null;
    }
}

watch([isBlameVisible, () => props.filename], async () => {
    await loadBlame();
    await nextTick();
    if (fileEditor) fileEditor.layout();
});

function updateVisibleBlame() {
    if (!fileEditor || !isBlameVisible.value) return;
    blameScrollTop.value = fileEditor.getScrollTop();
    const ranges = fileEditor.getVisibleRanges();

    if (ranges && ranges.length > 0) {
        let start = Math.max(1, ranges[0].startLineNumber - 5);
        let end = ranges[ranges.length - 1].endLineNumber + 5;
        
        let visible = [];

        for (let i = start; i <= end; i++) {
            let topPosition = fileEditor.getTopForLineNumber(i);
            let nextTopPosition = fileEditor.getTopForLineNumber(i + 1);
            let height = nextTopPosition - topPosition;

            if (height <= 0) continue; // Skip collapsed lines!

            let b = blameByLine.get(i);
            let prevB = blameByLine.get(i - 1);
            
            visible.push({
                line: i,
                top: topPosition,
                height: height,
                blame: b,
                isNewCommit: b && (!prevB || b.commit !== prevB.commit)
            });
        }

        visibleBlame.value = visible;
    }
}

const isImage = computed(() => {
    return props.filename && /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(props.filename);
});

const isMarkdown = computed(() => {
    return props.filename && /\.(md|markdown)$/i.test(props.filename);
});

const isNewOrUntracked = computed(() => {
    return !props.original && !!props.modified;
});

const viewMode = ref<'visual' | 'code'>(isImage.value ? 'visual' : 'code');

const monaco = ref<any>(null);
let editor: any; // DiffEditor
let fileEditor: any; // Standard Editor for File View
let originalModel: any;
let modifiedModel: any;

async function setupEditor() {
  if (!container.value || viewMode.value !== 'code') return;
  monaco.value = await initMonaco();
  
  const language = getLanguage(props.filename);
  
  if (viewType.value === 'diff') {
      originalModel = monaco.value.editor.createModel(props.original, language);
      modifiedModel = monaco.value.editor.createModel(props.modified, language);

      editor = monaco.value.editor.createDiffEditor(container.value, {
        ...monacoOptions,
        theme: getMonacoTheme(currentTheme.value),
        renderSideBySide: renderSideBySide.value,
        readOnly: props.readOnly ?? true,
        diffWordWrap: isWordWrap.value ? 'on' : 'off',
        wordWrap: isWordWrap.value ? 'on' : 'off',
        ignoreTrimWhitespace: ignoreWhitespace.value,
        hideUnchangedRegions: { enabled: isHunkView.value },
      });

      editor.setModel({ original: originalModel, modified: modifiedModel });

      modifiedModel.onDidChangeContent(() => {
        emit('update:modified', modifiedModel.getValue());
      });
  } else {
      originalModel = monaco.value.editor.createModel(props.original, language);
      modifiedModel = monaco.value.editor.createModel(props.modified, language);
      fileEditor = monaco.value.editor.create(container.value, {
        ...monacoOptions,
        theme: getMonacoTheme(currentTheme.value),
        readOnly: props.readOnly ?? true,
        wordWrap: isWordWrap.value ? 'on' : 'off',
      });
      fileEditor.setModel(modifiedModel);

      fileEditor.onDidScrollChange(() => updateVisibleBlame());
      fileEditor.onDidLayoutChange(() => updateVisibleBlame());
      
      if (isBlameVisible.value) {
          loadBlame();
      }

      modifiedModel.onDidChangeContent(() => {
        emit('update:modified', modifiedModel.getValue());
      });
  }
}

function destroyEditor() {
  if (editor) { editor.dispose(); editor = null; }
  if (fileEditor) { fileEditor.dispose(); fileEditor = null; }
  if (originalModel) { originalModel.dispose(); originalModel = null; }
  if (modifiedModel) { modifiedModel.dispose(); modifiedModel = null; }
}

function prevChange() {
    if (editor && viewType.value === 'diff') {
        if (typeof editor.goToDiff === 'function') {
            editor.goToDiff('previous');
        } else {
            editor.getModifiedEditor().getAction('editor.action.compareEditor.previousChange')?.run();
        }
    }
}

function nextChange() {
    if (editor && viewType.value === 'diff') {
        if (typeof editor.goToDiff === 'function') {
            editor.goToDiff('next');
        } else {
            editor.getModifiedEditor().getAction('editor.action.compareEditor.nextChange')?.run();
        }
    }
}

watch(viewType, async () => {
    isBlameVisible.value = false;
    destroyEditor();
    await nextTick();
    setupEditor();
});

watch(isWordWrap, (val) => {
    const wwOpt = val ? 'on' : 'off';
    if (editor) editor.updateOptions({ diffWordWrap: wwOpt, wordWrap: wwOpt });
    if (fileEditor) fileEditor.updateOptions({ wordWrap: wwOpt });
});

watch(ignoreWhitespace, (val) => {
    if (editor) editor.updateOptions({ ignoreTrimWhitespace: val });
});

watch(viewMode, async (val) => {
    if (val === 'code') {
        await nextTick();
        setupEditor();
    } else {
        destroyEditor();
    }
});

watch(() => props.filename, () => {
    viewMode.value = isImage.value ? 'visual' : 'code';
});

watch([() => props.original, () => props.modified], () => {
  if (originalModel) originalModel.setValue(props.original ?? '');
  if (modifiedModel) modifiedModel.setValue(props.modified ?? '');

  const language = getLanguage(props.filename);
  if (monaco.value && originalModel && modifiedModel) {
    monaco.value.editor.setModelLanguage(originalModel, language);
    monaco.value.editor.setModelLanguage(modifiedModel, language);
  }

  // Re-attach the models so the diff editor actually recomputes for the newly
  // selected file. Plain setValue sometimes left the diff showing stale/blank
  // content until the user manually toggled file<->diff (which recreated it).
  if (editor && originalModel && modifiedModel) {
    editor.setModel(null);
    editor.setModel({ original: originalModel, modified: modifiedModel });
  }
});

let rafId: number | null = null;
watch([() => layoutRefs.statusWidth.value, () => layoutRefs.detailsWidth.value], () => {
  if (isResizing.value) return; // Skip during heavy drag to keep UI smooth

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    if (editor) editor.layout();
    if (fileEditor) fileEditor.layout();
  });
}, { immediate: true });

watch(isResizing, (val) => {
  if (!val) {
    // End of resize, final layout to ensure everything fits
    if (editor) editor.layout();
    if (fileEditor) fileEditor.layout();
  }
});

watch(isHunkView, (val) => {
  setItem('gitbox_diff_hunk_view', val ? 'true' : 'false');
  if (editor && editor.updateOptions) {
    editor.updateOptions({ 
        hideUnchangedRegions: { enabled: val }
    });
  }
});

watch(renderSideBySide, (val) => {
  setItem('gitbox_diff_render_mode', val ? 'split' : 'inline');
  if (editor && editor.updateOptions) {
    editor.updateOptions({ 
        renderSideBySide: val
    });
  }
});

watch(currentTheme, (val) => {
  if (monaco.value) {
    monaco.value.editor.setTheme(getMonacoTheme(val));
  }
});

onMounted(setupEditor);
onBeforeUnmount(() => {
  destroyEditor();
});

function handleBlameResize() {
    if (fileEditor) fileEditor.layout();
}

// When the panel is narrow the toolbar overflows horizontally. Translate a
// vertical wheel into horizontal scroll so every option is reachable smoothly
// instead of being skipped/unreachable behind the hidden scrollbar.
function onToolbarWheel(e: WheelEvent) {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth) return;
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!delta) return;
    el.scrollLeft += delta;
    e.preventDefault();
}
</script>

<template>
  <div :class="cn('flex-1 v-stack min-h-0 min-w-0 bg-white dark:bg-[#1E1E1E] h-full', props.class)">
    <div class="shrink-0 bg-neutral-100 dark:bg-[#252526] border-b border-neutral-200 dark:border-neutral-800 px-3 h-10 h-stack justify-between gap-2 z-10 select-none overflow-hidden">
      <!-- Left: File Ident & Extra Actions -->
      <div class="h-stack gap-3 min-w-0 flex-1 pr-2">
        <div class="min-w-0 overflow-hidden flex items-center gap-2"
             @mouseenter="startMarquee($event, '.diff-filename')" @mouseleave="stopMarquee($event, '.diff-filename')">
          <Icon icon="lucide:file-code" class="text-xs text-neutral-600 shrink-0" />
          <span class="diff-filename text-[10px] font-bold text-neutral-500 uppercase tracking-widest truncate block">
            {{ filename || t('history.changes') }}
          </span>
        </div>
        
        <div class="h-stack gap-1 border-l border-neutral-300 dark:border-neutral-700 ml-2 pl-3 bg-neutral-100/50 dark:bg-neutral-900/50 p-1 rounded border border-neutral-200 dark:border-neutral-800 h-9" v-if="isImage || isMarkdown">
            <IconButton direction="row" 
                         :showLabel="false"
                         :icon="viewMode === 'visual' ? 'lucide:code' : (isMarkdown ? 'lucide:file-text' : 'lucide:image')" 
                         :label="t('diff.toggle_view_mode')"
                         @click="viewMode = viewMode === 'visual' ? 'code' : 'visual'" />
        </div>
      </div>

      <!-- Right: Centralized Controls -->
      <div class="h-stack gap-2 min-w-0 shrink overflow-x-auto [&::-webkit-scrollbar]:hidden" @wheel="onToolbarWheel">
        <!-- Group 1: Formatting & Diff Options (Word Wrap, Whitespace, Split, Hunks) -->
        <div v-if="viewMode === 'code' || (viewMode === 'visual' && isMarkdown)" class="h-stack items-center gap-1 bg-neutral-100/50 dark:bg-neutral-900/50 p-1 rounded border border-neutral-200 dark:border-neutral-800 h-9 shrink-0">
            <IconButton direction="row"
                         :showLabel="false"
                         icon="lucide:wrap-text"
                         :label="t('diff.word_wrap')"
                         :active="isWordWrap"
                         @click="isWordWrap = !isWordWrap" />

            <template v-if="viewType === 'diff' || isMarkdown">
                <div class="w-px h-3 bg-neutral-200 dark:bg-neutral-800 mx-1"></div>
                
                <IconButton direction="row"
                            :showLabel="false"
                            icon="lucide:type"
                            :label="t('diff.ignore_whitespace')"
                            :active="ignoreWhitespace"
                            @click="ignoreWhitespace = !ignoreWhitespace" />

                <div class="w-px h-3 bg-neutral-200 dark:bg-neutral-800 mx-1"></div>

                <IconButton direction="row"
                            :showLabel="false"
                            icon="lucide:layers"
                            :label="t('diff.show_hunks_only')"
                            :active="isHunkView"
                            @click="isHunkView = !isHunkView" />

                <IconButton direction="row"
                            :showLabel="false"
                            icon="lucide:columns"
                            :label="t('diff.side_by_side')"
                            :active="renderSideBySide"
                            @click="renderSideBySide = true" />
                            
                <IconButton direction="row"
                            :showLabel="false"
                            icon="lucide:rows"
                            :label="t('diff.inline_view')"
                            :active="!renderSideBySide"
                            @click="renderSideBySide = false" />
            </template>
        </div>

        <!-- Group 2: Blame -->
        <div v-if="viewType === 'file' && !isNewOrUntracked" class="h-stack items-center bg-neutral-100/50 dark:bg-neutral-900/50 p-1 rounded border border-neutral-200 dark:border-neutral-800 h-9 shrink-0">
            <IconButton direction="row"
                         :showLabel="true"
                         icon="lucide:git-commit-vertical"
                         :label="t('diff.blame')"
                         :active="isBlameVisible"
                         @click="isBlameVisible = !isBlameVisible" />
        </div>

        <!-- Group 3: Main View Mode Toggle -->
        <div class="h-stack items-center bg-neutral-100/50 dark:bg-neutral-900/50 rounded border border-neutral-200 dark:border-neutral-800 p-1 ml-1 h-9 gap-1 shrink-0">
           <IconButton direction="row"
                        :showLabel="true"
                        icon="lucide:file-text"
                        :label="t('diff.file_view')"
                        :active="viewType === 'file'"
                        @click="viewType = 'file'" />
           <IconButton direction="row"
                        :showLabel="true"
                        icon="lucide:git-diff"
                        :label="t('diff.diff_view')"
                        :active="viewType === 'diff'"
                        @click="viewType = 'diff'" />
        </div>

        <!-- Group 4: Navigation (Diff only) -->
        <div v-if="viewType === 'diff' && viewMode === 'code'" class="h-stack items-center bg-neutral-100/50 dark:bg-neutral-900/50 rounded border border-neutral-200 dark:border-neutral-800 p-1 h-9 shrink-0">
           <IconButton direction="row"
                        :showLabel="false"
                        icon="lucide:chevron-up"
                        :label="t('diff.prev_change')"
                        tooltip-position="top"
                        @click="prevChange" />
           <IconButton direction="row"
                        :showLabel="false"
                        icon="lucide:chevron-down"
                        :label="t('diff.next_change')"
                        tooltip-position="top"
                        @click="nextChange" />
        </div>
      </div>
    </div>
    
    <div v-show="viewMode === 'code'" class="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
        <div v-if="isBlameVisible && viewType === 'file'" class="shrink-0 bg-white dark:bg-[#1E1E1E] border-r border-neutral-200 dark:border-neutral-800 overflow-hidden relative select-none z-10 v-stack" :style="{ width: blameWidth + 'px' }">
            <div v-if="isBlameLoading" class="absolute inset-0 center bg-white/80 dark:bg-[#1e1e1e]/80 z-20">
                <Icon icon="lucide:loader-2" class="animate-spin text-neutral-500 text-xl" />
            </div>
            
            <div v-if="blameError" class="p-4 text-xs text-red-400 text-center flex-1 overflow-auto opacity-70">
                {{ blameError }}
            </div>
            <div v-else class="absolute left-0 right-0 top-0 transition-none will-change-transform" :style="{ transform: `translateY(-${blameScrollTop}px)` }">
                <div v-for="vb in visibleBlame" :key="vb.line" class="absolute left-0 w-full h-stack px-1 group border-t border-transparent overflow-hidden" :style="{ top: vb.top + 'px', height: vb.height + 'px' }">
                    <template v-if="vb.blame && vb.isNewCommit">
                        <div class="h-full w-full h-stack items-center border-t border-neutral-200/50 dark:border-neutral-800/50 -mt-[1px] px-1 group-hover:bg-neutral-200/50 dark:group-hover:bg-[#2A2D31]/50 transition-colors">
                          <Tooltip :text="`Commit: ${vb.blame.commit}\nAuthor: ${vb.blame.author} <${vb.blame.email || 'N/A'}>\nDate: ${new Date(Number(vb.blame.time)*1000).toLocaleString()}\n\n${vb.blame.summary}`" position="right">
                            <div class="relative shrink-0 mr-3 center">
                              <img :src="gravatarUrl(vb.blame.email)" class="w-4 h-4 rounded-sm border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-[#252526] shadow-sm cursor-help hover:ring-1 hover:ring-blue-500/50 transition-all" />
                            </div>
                          </Tooltip>
                          <Tooltip :text="vb.blame.summary" position="right" class="flex-1 mr-2 min-w-0">
                            <span class="truncate text-[11px] font-mono text-neutral-600/80 dark:text-neutral-400/80 group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors cursor-default">{{ vb.blame.summary }}</span>
                          </Tooltip>
                          <Tooltip :text="new Date(Number(vb.blame.time)*1000).toLocaleString()" position="right">
                            <span class="truncate text-[10.5px] font-mono font-medium opacity-50 shrink-0 group-hover:opacity-80 transition-opacity">{{ new Date(Number(vb.blame.time)*1000).toLocaleDateString('en-GB') }}</span>
                          </Tooltip>
                        </div>
                    </template>
                    <div v-else-if="vb.blame && !vb.isNewCommit" class="w-[2px] h-full bg-neutral-200/30 dark:bg-neutral-800/30 ml-[7px] group-hover:bg-blue-500/50 transition-colors"></div>
                </div>
            </div>
        </div>
        
        <Resizer v-if="isBlameVisible && viewType === 'file'" :target="layoutRefs.blameWidth" :options="{ min: 100, max: 800, clampToContainer: true, reserve: 240 }" @resize="handleBlameResize" />

        <div ref="container" class="flex-1 min-w-0"></div>
    </div>
    
    <ImageDiffViewer v-if="viewMode === 'visual' && isImage" 
                     :original="original" 
                     :modified="modified" 
                     :filename="filename" />
                     
    <MarkdownDiffViewer v-if="viewMode === 'visual' && isMarkdown" 
                       :original="original"
                       :modified="modified"
                       :is-inline="!renderSideBySide"
                       :is-hunk-view="isHunkView" />
  </div>
</template>

<style>
.monaco-editor .scroll-decoration { box-shadow: none !important; }
.monaco-editor .scrollbar .slider {
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 10px !important;
  transition: background 0.2s;
}
.monaco-editor .scrollbar .slider:hover {
  background: rgba(255, 255, 255, 0.2) !important;
  border-radius: 10px !important;
}
</style>

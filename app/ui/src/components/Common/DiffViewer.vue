<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';
import ImageDiffViewer from './ImageDiffViewer.vue';
import MarkdownDiffViewer from './MarkdownDiffViewer.vue';
import IconButton from './IconButton.vue';
import { generalSettings } from '../../services/settingsService';
import { repoPath } from '../../services/gitService';
import { formatDistanceToNow } from '../../utils/formatters';
import { gravatarUrl } from '../../utils/avatars';

const { t } = useI18n();
const { currentTheme } = useTheme();

const displayLabels = computed(() => !generalSettings.value.hideIconLabels);

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
  readOnly?: boolean;
  inline?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modified', value: string): void;
  (e: 'save', value: string): void;
}>();

const container = ref<HTMLElement | null>(null);
const diffMode = ref<'split' | 'inline' | 'hunk'>(props.inline ? 'inline' : 'split');
const viewType = ref<'diff' | 'file'>('diff');
const isWordWrap = ref(false);
const ignoreWhitespace = ref(false);
const isBlameVisible = ref(false);
const blameData = ref<any[]>([]);
const isBlameLoading = ref(false);
const visibleBlame = ref<any[]>([]);
const blameScrollTop = ref(0);
const blameError = ref<string | null>(null);

async function loadBlame() {
    blameError.value = null;
    console.log('[Blame] Loading started...', { isBlameVisible: isBlameVisible.value, filename: props.filename, viewType: viewType.value, repoPath: repoPath.value });
    if (isBlameVisible.value && props.filename && viewType.value === 'file') {
        isBlameLoading.value = true;

        try {
            blameData.value = await (window as any).gitbox.getFileBlame(repoPath.value, props.filename);
            console.log('[Blame] Data loaded! Total lines:', blameData.value?.length);
            if (blameData.value === null || blameData.value.length === 0) {
                 blameError.value = 'No blame data available (file might be untracked).';
            }
        } catch (e: any) {
            console.error('[Blame] Error:', e);
            blameError.value = e.message || String(e);
            blameData.value = [];
        } finally {
            isBlameLoading.value = false;
            updateVisibleBlame();
        }
    } else {
        blameData.value = [];
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

            let b = blameData.value.find((x: any) => x.line === i);
            let prevB = blameData.value.find((x: any) => x.line === i - 1);
            
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
        renderSideBySide: diffMode.value === 'split',
        readOnly: props.readOnly ?? true,
        diffWordWrap: isWordWrap.value ? 'on' : 'off',
        wordWrap: isWordWrap.value ? 'on' : 'off',
        ignoreTrimWhitespace: ignoreWhitespace.value,
        hideUnchangedRegions: { enabled: diffMode.value === 'hunk' },
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
  if (originalModel) originalModel.setValue(props.original);
  if (modifiedModel) modifiedModel.setValue(props.modified);
  
  const language = getLanguage(props.filename);
  if (monaco.value && originalModel && modifiedModel) {
    monaco.value.editor.setModelLanguage(originalModel, language);
    monaco.value.editor.setModelLanguage(modifiedModel, language);
  }
});

watch(diffMode, (val) => {
  if (editor && editor.updateOptions) {
    editor.updateOptions({ 
        renderSideBySide: val === 'split',
        hideUnchangedRegions: { enabled: val === 'hunk' }
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
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 min-w-0 bg-[#1E1E1E] h-full">
    <div class="flex-shrink-0 bg-[#252526] border-b border-neutral-800 px-3 py-1 flex items-center justify-between z-10">
      <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest truncate flex items-center gap-2">
        <Icon icon="lucide:file-code" class="text-neutral-600" />
        {{ filename || t('history.changes') }}
      </div>
      <div class="flex items-center gap-1">
        <div v-if="viewType === 'diff' && viewMode === 'code'" class="flex items-center">
            <IconButton icon="lucide:arrow-up" label="Previous" @click="prevChange" tooltip="Previous Change" class="mr-1" />
            <IconButton icon="lucide:arrow-down" label="Next" @click="nextChange" tooltip="Next Change" class="mr-2" />
        </div>

        <IconButton v-if="isImage || isMarkdown" 
                    direction="row" 
                    :showLabel="displayLabels"
                    :icon="viewMode === 'visual' ? 'lucide:code' : (isMarkdown ? 'lucide:file-text' : 'lucide:image')" 
                    :label="viewMode === 'visual' ? 'Code' : 'Visual'" 
                    @click="viewMode = viewMode === 'visual' ? 'code' : 'visual'" 
                    class="mr-2" />

        <template v-if="viewMode === 'code' || (viewMode === 'visual' && isMarkdown)">
            <template v-if="viewType === 'diff' || isMarkdown">
                <IconButton direction="row"
                            :showLabel="displayLabels"
                            icon="lucide:layers"
                            :label="t('changes.hunks_only')"
                            :active="diffMode === 'hunk'"
                            :tooltip="t('changes.hunks_only')"
                            @click="diffMode = 'hunk'" />

                <IconButton direction="row"
                            :showLabel="displayLabels"
                            icon="lucide:columns"
                            :label="t('changes.side_by_side')"
                            :active="diffMode === 'split'"
                            tooltip="Split View"
                            @click="diffMode = 'split'" />
                            
                <IconButton direction="row"
                            :showLabel="displayLabels"
                            icon="lucide:rows"
                            :label="t('changes.inline')"
                            :active="diffMode === 'inline'"
                            tooltip="Inline View"
                            @click="diffMode = 'inline'" />
                            
                <div class="w-px h-4 bg-neutral-700 mx-2"></div>
                
                <IconButton direction="row"
                            :showLabel="displayLabels"
                            icon="lucide:type"
                            label="Ignore Whitespace"
                            :active="ignoreWhitespace"
                            tooltip="Ignore Whitespace"
                            @click="ignoreWhitespace = !ignoreWhitespace" />
            </template>

            <IconButton direction="row"
                        :showLabel="displayLabels"
                        icon="lucide:wrap-text"
                        label="Word Wrap"
                        :active="isWordWrap"
                        tooltip="Word Wrap"
                        @click="isWordWrap = !isWordWrap" />
        </template>
        
        <button v-if="viewType === 'file' && !isNewOrUntracked" @click="isBlameVisible = !isBlameVisible" class="ml-3 mr-0 bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white px-3 py-1 rounded text-xs transition-colors flex items-center gap-2" :class="{'bg-blue-900/40 text-blue-400 border-blue-500/50': isBlameVisible}">
           <Icon icon="lucide:git-commit" />
           Blame
        </button>
        
        <div class="flex items-center bg-neutral-900 rounded border border-neutral-700 p-[3px] text-xs font-medium ml-2">
           <button @click="viewType = 'file'" class="px-3 py-1 rounded-sm transition-colors" :class="viewType === 'file' ? 'bg-blue-600/50 text-white' : 'text-neutral-500 hover:text-neutral-300'">File View</button>
           <button @click="viewType = 'diff'" class="px-3 py-1 rounded-sm transition-colors" :class="viewType === 'diff' ? 'bg-blue-600/50 text-white' : 'text-neutral-500 hover:text-neutral-300'">Diff View</button>
        </div>
      </div>
    </div>
    
    <div v-show="viewMode === 'code'" class="flex-1 flex min-h-0 min-w-0 overflow-hidden relative">
        <div v-if="isBlameVisible && viewType === 'file'" class="w-[300px] flex-shrink-0 bg-[#1E1E1E] border-r border-neutral-800 overflow-hidden relative select-none z-10 flex flex-col">
            <div v-if="isBlameLoading" class="absolute inset-0 flex items-center justify-center bg-[#1e1e1e]/80 z-20">
                <Icon icon="lucide:loader-2" class="animate-spin text-neutral-500 text-xl" />
            </div>
            
            <div v-if="blameError" class="p-4 text-xs text-red-400 text-center flex-1 overflow-auto opacity-70">
                {{ blameError }}
            </div>
            <div v-else class="absolute left-0 right-0 top-0 transition-none will-change-transform" :style="{ transform: `translateY(-${blameScrollTop}px)` }">
                <div v-for="vb in visibleBlame" :key="vb.line" class="absolute left-0 w-full flex items-center px-1 group border-t border-transparent" :style="{ top: vb.top + 'px', height: vb.height + 'px' }">
                    <template v-if="vb.blame && vb.isNewCommit">
                       <div class="h-full w-full flex items-center border-t border-neutral-800/50 -mt-[1px] px-1 group-hover:bg-[#2A2D31]/50 transition-colors">
                         <div class="relative flex-shrink-0 mr-3 flex items-center justify-center" :title="`Commit: ${vb.blame.commit}\nAuthor: ${vb.blame.author} <${vb.blame.email || 'N/A'}>\nDate: ${new Date(Number(vb.blame.time)*1000).toLocaleString()}\n\n${vb.blame.summary}`">
                           <img :src="gravatarUrl(vb.blame.email)" class="w-4 h-4 rounded-sm border border-neutral-700 bg-[#252526] shadow-sm cursor-help hover:ring-1 hover:ring-blue-500/50 transition-all" />
                         </div>
                         <span class="truncate text-[11px] font-mono text-neutral-400/80 group-hover:text-neutral-300 transition-colors flex-1 mr-2 cursor-default" :title="vb.blame.summary">{{ vb.blame.summary }}</span>
                         <span class="truncate text-[10.5px] font-mono font-medium opacity-50 shrink-0 group-hover:opacity-80 transition-opacity" :title="new Date(Number(vb.blame.time)*1000).toLocaleString()">{{ new Date(Number(vb.blame.time)*1000).toLocaleDateString('en-GB') }}</span>
                       </div>
                    </template>
                    <div v-else-if="vb.blame && !vb.isNewCommit" class="w-[2px] h-full bg-neutral-800/30 ml-[7px] group-hover:bg-blue-500/50 transition-colors"></div>
                </div>
            </div>
        </div>
        <div ref="container" class="flex-1 min-w-0"></div>
    </div>
    
    <ImageDiffViewer v-if="viewMode === 'visual' && isImage" 
                     :original="original" 
                     :modified="modified" 
                     :filename="filename" />
                     
    <MarkdownDiffViewer v-if="viewMode === 'visual' && isMarkdown" 
                      :original="original"
                      :modified="modified"
                      :is-inline="diffMode !== 'split'"
                      :is-hunk-view="diffMode === 'hunk'" />
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
}
</style>

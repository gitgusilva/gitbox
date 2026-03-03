<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';
import ImageDiffViewer from './ImageDiffViewer.vue';
import MarkdownDiffViewer from './MarkdownDiffViewer.vue';
import IconButton from './IconButton.vue';

const { t } = useI18n();
const { currentTheme } = useTheme();

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
const isInline = ref(props.inline ?? false);
const isHunkView = ref(false);

const isImage = computed(() => {
    return props.filename && /\.(png|jpe?g|gif|webp|ico|svg)$/i.test(props.filename);
});

const isMarkdown = computed(() => {
    return props.filename && /\.(md|markdown)$/i.test(props.filename);
});

const viewMode = ref<'visual' | 'code'>(isImage.value ? 'visual' : 'code');

const monaco = ref<any>(null);
let editor: any; // DiffEditor
let originalModel: any;
let modifiedModel: any;

async function setupEditor() {
  if (!container.value || viewMode.value !== 'code') return;
  monaco.value = await initMonaco();
  
  const language = getLanguage(props.filename);
  originalModel = monaco.value.editor.createModel(props.original, language);
  modifiedModel = monaco.value.editor.createModel(props.modified, language);

  editor = monaco.value.editor.createDiffEditor(container.value, {
    ...monacoOptions,
    theme: getMonacoTheme(currentTheme.value),
    renderSideBySide: !isInline.value,
    readOnly: props.readOnly ?? true,
    diffWordWrap: 'off',
    hideUnchangedRegions: { enabled: isHunkView.value },
  });

  editor.setModel({ original: originalModel, modified: modifiedModel });

  modifiedModel.onDidChangeContent(() => {
    emit('update:modified', modifiedModel.getValue());
  });
}

function destroyEditor() {
  if (editor) { editor.dispose(); editor = null; }
  if (originalModel) { originalModel.dispose(); originalModel = null; }
  if (modifiedModel) { modifiedModel.dispose(); modifiedModel = null; }
}

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

watch(isInline, (val) => {
  if (editor && editor.updateOptions) {
    editor.updateOptions({ renderSideBySide: !val });
  }
});

watch(isHunkView, (val) => {
  if (editor && editor.updateOptions) {
    editor.updateOptions({ hideUnchangedRegions: { enabled: val } });
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
  <div class="flex-1 flex flex-col min-h-0 bg-[#1E1E1E]">
    <div class="flex-shrink-0 bg-[#252526] border-b border-neutral-800 px-3 py-1 flex items-center justify-between z-10">
      <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest truncate flex items-center gap-2">
        <Icon icon="lucide:file-code" class="text-neutral-600" />
        {{ filename || t('history.changes') }}
      </div>
      <div class="flex items-center gap-1">
        <IconButton v-if="isImage || isMarkdown" 
                    direction="row" 
                    :showLabel="true"
                    :icon="viewMode === 'visual' ? 'lucide:code' : (isMarkdown ? 'lucide:file-text' : 'lucide:image')" 
                    :label="viewMode === 'visual' ? 'Code' : 'Visual'" 
                    @click="viewMode = viewMode === 'visual' ? 'code' : 'visual'" 
                    class="mr-2" />

        <template v-if="viewMode === 'code' || (viewMode === 'visual' && isMarkdown)">
        <IconButton direction="row"
                    :showLabel="true"
                    :icon="isHunkView ? 'lucide:layers-2' : 'lucide:layers'"
                    :label="isHunkView ? t('changes.hunks_only') : t('changes.show_all')"
                    :active="isHunkView"
                    :tooltip="t('changes.hunks_only')"
                    @click="isHunkView = !isHunkView" />

        <IconButton direction="row"
                    :showLabel="true"
                    :icon="isInline ? 'lucide:rows' : 'lucide:columns'"
                    :label="isInline ? t('changes.inline') : t('changes.side_by_side')"
                    :active="isInline"
                    tooltip="Toggle Inline/Side-by-Side"
                    @click="isInline = !isInline" />
        </template>
      </div>
    </div>
    
    <div v-show="viewMode === 'code'" ref="container" class="flex-1"></div>
    
    <ImageDiffViewer v-if="viewMode === 'visual' && isImage" 
                     :original="original" 
                     :modified="modified" 
                     :filename="filename" />
                     
    <MarkdownDiffViewer v-if="viewMode === 'visual' && isMarkdown" 
                      :original="original"
                      :modified="modified"
                      :is-inline="isInline"
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
}
</style>

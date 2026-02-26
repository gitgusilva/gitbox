<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import loader from '@monaco-editor/loader';
import { Icon } from '@iconify/vue';
import { useTheme } from '../../services/themeService';

const { currentTheme } = useTheme();

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
  readOnly?: boolean;
  inline?: boolean;
  mode?: 'diff' | 'merge';
}>();

const emit = defineEmits<{
  (e: 'update:modified', value: string): void;
  (e: 'save', value: string): void;
}>();

const container = ref<HTMLElement | null>(null);
const isInline = ref(props.inline ?? false);
const isHunkView = ref(false);

let monaco: any;
let editor: any; // DiffEditor
let originalModel: any;
let modifiedModel: any;

function getLanguage(path: string = '') {
  const parts = path.split('.');
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  const map: Record<string, string> = {
    'js': 'javascript', 'ts': 'typescript', 'vue': 'html', 'html': 'html',
    'css': 'css', 'json': 'json', 'md': 'markdown', 'py': 'python',
    'rs': 'rust', 'go': 'go', 'cpp': 'cpp', 'cc': 'cpp', 'h': 'cpp',
    'php': 'php', 'rb': 'ruby', 'java': 'java', 'cs': 'csharp'
  };
  return (ext && map[ext]) || 'plaintext';
}

async function initEditor() {
  if (!container.value) return;
  monaco = await loader.init();
  
  const language = getLanguage(props.filename);
  originalModel = monaco.editor.createModel(props.original, language);
  modifiedModel = monaco.editor.createModel(props.modified, language);

  const themeName = currentTheme.value === 'light' || (currentTheme.value === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'vs' : 'vs-dark';

  editor = monaco.editor.createDiffEditor(container.value, {
    theme: themeName,
    renderSideBySide: !isInline.value,
    readOnly: props.readOnly ?? true,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderOverviewRuler: false,
    diffWordWrap: 'off',
    hideUnchangedRegions: { enabled: isHunkView.value }
  });

  editor.setModel({ original: originalModel, modified: modifiedModel });

  modifiedModel.onDidChangeContent(() => {
    emit('update:modified', modifiedModel.getValue());
  });
}

watch([() => props.original, () => props.modified], () => {
  if (originalModel) originalModel.setValue(props.original);
  if (modifiedModel) modifiedModel.setValue(props.modified);
  
  const language = getLanguage(props.filename);
  if (monaco) {
    monaco.editor.setModelLanguage(originalModel, language);
    monaco.editor.setModelLanguage(modifiedModel, language);
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
  if (monaco) {
    const themeName = val === 'light' || (val === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'vs' : 'vs-dark';
    monaco.editor.setTheme(themeName);
  }
});

onMounted(initEditor);
onBeforeUnmount(() => {
  if (editor) editor.dispose();
  if (originalModel) originalModel.dispose();
  if (modifiedModel) modifiedModel.dispose();
});
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 bg-[#1E1E1E]">
    <div class="flex-shrink-0 bg-[#252526] border-b border-neutral-800 px-3 py-1 flex items-center justify-between">
      <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest truncate flex items-center gap-2">
        <Icon icon="lucide:file-code" class="text-neutral-600" />
        {{ filename || 'Diff' }}
      </div>
      <div class="flex items-center gap-1">
        <button @click="isHunkView = !isHunkView" 
                class="p-1 rounded hover:bg-neutral-700 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter px-2"
                :class="isHunkView ? 'bg-orange-600/20 text-orange-400' : 'text-neutral-500'"
                title="Toggle Hunk/Show All">
          <Icon :icon="isHunkView ? 'lucide:layers-2' : 'lucide:layers'" class="text-xs" />
          <span>{{ isHunkView ? 'Hunks Only' : 'Show All' }}</span>
        </button>

        <button @click="isInline = !isInline" 
                class="p-1 rounded hover:bg-neutral-700 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter px-2"
                :class="isInline ? 'bg-blue-600/20 text-blue-400' : 'text-neutral-500'"
                title="Toggle Inline/Side-by-Side">
          <Icon :icon="isInline ? 'lucide:rows' : 'lucide:columns'" class="text-xs" />
          <span>{{ isInline ? 'Inline' : 'Side-by-Side' }}</span>
        </button>
        <button v-if="!(props.readOnly ?? true)" @click="emit('save', modifiedModel.getValue())"
                class="ml-2 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter text-white"
                title="Save Merge Resolution">
          <Icon icon="lucide:save" class="text-xs" />
          <span>Save Merge</span>
        </button>
      </div>
    </div>
    <div ref="container" class="flex-1"></div>
  </div>
</template>

<style>
.monaco-editor .scroll-decoration { box-shadow: none !important; }
</style>

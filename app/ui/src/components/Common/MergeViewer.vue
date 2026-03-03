<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';

const { t } = useI18n();
const { currentTheme } = useTheme();

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modified', value: string): void;
  (e: 'save', value: string): void;
}>();

const container = ref<HTMLElement | null>(null);

const monaco = ref<any>(null);
let editor: any; // DiffEditor (used for 2-way merge)
let originalModel: any;
let modifiedModel: any;

async function setupEditor() {
  if (!container.value) return;
  monaco.value = await initMonaco();
  
  const language = getLanguage(props.filename);
  originalModel = monaco.value.editor.createModel(props.original, language);
  modifiedModel = monaco.value.editor.createModel(props.modified, language);

  editor = monaco.value.editor.createDiffEditor(container.value, {
    ...monacoOptions,
    theme: getMonacoTheme(currentTheme.value),
    renderSideBySide: true,
    readOnly: props.readOnly ?? false,
  });

  editor.setModel({ original: originalModel, modified: modifiedModel });

  modifiedModel.onDidChangeContent(() => {
    emit('update:modified', modifiedModel.getValue());
  });
}

watch([() => props.original, () => props.modified], () => {
    if (originalModel) originalModel.setValue(props.original);
    if (modifiedModel) modifiedModel.setValue(props.modified);
});

watch(currentTheme, (val) => {
  if (monaco.value) {
    monaco.value.editor.setTheme(getMonacoTheme(val));
  }
});

onMounted(setupEditor);
onBeforeUnmount(() => {
  if (editor) editor.dispose();
  if (originalModel) originalModel.dispose();
  if (modifiedModel) modifiedModel.dispose();
});
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 bg-[#1E1E1E]">
    <div class="flex-shrink-0 bg-[#252526] border-b border-neutral-800 px-3 py-2 flex items-center justify-between">
      <div class="text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate flex items-center gap-2">
        <Icon icon="lucide:split" class="text-orange-500" />
        {{ t('changes.merging') }}: {{ filename || t('changes.untitled') }}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[9px] text-neutral-500 italic mr-2">{{ t('changes.original_vs_resolution') }}</span>
        <button @click="emit('save', modifiedModel.getValue())"
                class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter text-white"
                :title="t('changes.complete_merge')">
          <Icon icon="lucide:save" class="text-xs" />
          <span>{{ t('changes.complete_merge') }}</span>
        </button>
      </div>
    </div>
    <div ref="container" class="flex-1"></div>
  </div>
</template>

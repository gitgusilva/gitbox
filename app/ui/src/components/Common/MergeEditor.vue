<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';
import Tooltip from './Tooltip.vue';
import { parseConflicts } from './merge-editor/conflictParser';
import type { ConflictBlock, ConflictState } from './merge-editor/types';
import { createResultInfoWidget, createSideConflictWidget } from './merge-editor/widgetFactory';
import { applyConflictViewZones, clearViewZones } from './merge-editor/viewZones';
import { bindModelsToEditors, createMergeEditors, createMergeModels, disposeMonacoResources, setupScrollSync } from './merge-editor/monacoRuntime';
import { useMergeConflictActions } from './merge-editor/useMergeConflictActions';
import { gravatarUrl } from '../../utils/avatars';

const { t } = useI18n();
const { currentTheme } = useTheme();

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
  repoPath?: string;
}>();

const emit = defineEmits<{
  (e: 'save', value: string): void;
  (e: 'complete', value: string): void;
  (e: 'state', value: { remainingConflicts: number; canCompleteMerge: boolean; isDirty: boolean }): void;
}>();

const incomingContainer = ref<HTMLElement | null>(null);
const currentContainer = ref<HTMLElement | null>(null);
const resultContainer = ref<HTMLElement | null>(null);
const compareContainer = ref<HTMLElement | null>(null);
const workspaceContainer = ref<HTMLElement | null>(null);

const leftPaneWidth = ref(0);
const topPaneHeight = ref(0);
const isComparingWithBase = ref(false);
const compareTarget = ref<'incoming' | 'current' | 'result'>('result');
const initialResultText = ref('');
const resolvedConflicts = ref<Set<number>>(new Set());
const isApplyingAction = ref(false);
const lastSavedValue = ref('');
const isDirty = ref(false);
const isWordWrap = ref(false);
const onlyConflicts = ref(false);

function applyWordWrap() {
  const w = isWordWrap.value ? 'on' : 'off';
  incomingEditor?.updateOptions({ wordWrap: w });
  currentEditor?.updateOptions({ wordWrap: w });
  resultEditor?.updateOptions({ wordWrap: w });
  compareEditor?.updateOptions({ wordWrap: w, diffWordWrap: w });
}

// "Only conflicts": collapse the non-conflict regions in ALL three editors
// (incoming, current, result) so the user can focus on what needs resolving.
// The three models are line-aligned on conflicts, so the same ranges apply.
function applyOnlyConflicts() {
  if (!monaco.value) return;
  const pairs: [any, any][] = [
    [incomingEditor, incomingModel],
    [currentEditor, currentModel],
    [resultEditor, resultModel],
  ];
  const ctx = 2;
  const sorted = [...conflicts.value].sort((a, b) => a.startLine - b.startLine);

  for (const [ed, model] of pairs) {
    if (!ed || !model) continue;
    if (!onlyConflicts.value || conflicts.value.length === 0) {
      (ed as any).setHiddenAreas?.([]);
      continue;
    }
    const total = model.getLineCount();
    const hidden: any[] = [];
    let cursor = 1;
    for (const c of sorted) {
      const visibleStart = Math.max(1, c.startLine - ctx);
      if (visibleStart > cursor) hidden.push(new monaco.value.Range(cursor, 1, visibleStart - 1, 1));
      cursor = Math.min(total, c.endLine + ctx) + 1;
    }
    if (cursor <= total) hidden.push(new monaco.value.Range(cursor, 1, total, 1));
    (ed as any).setHiddenAreas?.(hidden);
  }
}

watch(isWordWrap, applyWordWrap);
watch(onlyConflicts, applyOnlyConflicts);

// --- Blame (HEAD version, shown next to the result editor) ---
const showBlame = ref(false);
const blameData = ref<any[]>([]);
const isBlameLoading = ref(false);
const blameError = ref<string | null>(null);
const visibleBlame = ref<any[]>([]);
const blameScrollTop = ref(0);
const BLAME_WIDTH = 240;
let blameByLine = new Map<number, any>();

function rebuildBlameIndex() {
  blameByLine = new Map();
  for (const b of (blameData.value || [])) blameByLine.set(b.line, b);
}

async function loadBlame() {
  blameError.value = null;
  if (showBlame.value && props.repoPath && props.filename) {
    isBlameLoading.value = true;
    try {
      // HEAD version — `git blame` can't run on the unmerged worktree file.
      blameData.value = await (window as any).gitbox.getFileBlame(props.repoPath, props.filename, 'HEAD');
      if (!blameData.value || blameData.value.length === 0) blameError.value = t('changes.no_blame_available');
    } catch (e: any) {
      blameError.value = e?.message || String(e);
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

function updateVisibleBlame() {
  if (!resultEditor || !showBlame.value) { visibleBlame.value = []; return; }
  blameScrollTop.value = resultEditor.getScrollTop();
  const ranges = resultEditor.getVisibleRanges();
  if (!ranges || ranges.length === 0) return;
  const start = Math.max(1, ranges[0].startLineNumber - 5);
  const end = ranges[ranges.length - 1].endLineNumber + 5;
  const visible: any[] = [];
  for (let i = start; i <= end; i++) {
    const top = resultEditor.getTopForLineNumber(i);
    const height = resultEditor.getTopForLineNumber(i + 1) - top;
    if (height <= 0) continue;
    const b = blameByLine.get(i);
    const prevB = blameByLine.get(i - 1);
    visible.push({ line: i, top, height, blame: b, isNewCommit: b && (!prevB || b.commit !== prevB.commit) });
  }
  visibleBlame.value = visible;
}

watch(showBlame, loadBlame);

const monaco = ref<any>(null);
let incomingEditor: any = null;
let currentEditor: any = null;
let resultEditor: any = null;
let compareEditor: any = null;

let incomingModel: any = null;
let currentModel: any = null;
let baseModel: any = null;
let resultModel: any = null;

let incomingDecorations: string[] = [];
let currentDecorations: string[] = [];
let resultDecorations: string[] = [];

let conflictWidgetsIncoming: any[] = [];
let conflictWidgetsCurrent: any[] = [];
let conflictWidgetsResult: any[] = [];
let incomingZoneIds: string[] = [];
let currentZoneIds: string[] = [];
let resultZoneIds: string[] = [];
let editorSubscriptions: any[] = [];
let resizeObserver: ResizeObserver | null = null;

let draggingSplit: null | 'horizontal' | 'vertical' = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;

const conflicts = ref<ConflictBlock[]>([]);
const selectedConflictIndex = ref(0);

const totalConflicts = computed(() => conflicts.value.length);
const remainingConflicts = computed(() => Math.max(0, totalConflicts.value - resolvedConflicts.value.size));
const selectedConflict = computed(() => conflicts.value[selectedConflictIndex.value] ?? null);
const incomingRefLabel = computed(() => selectedConflict.value?.incomingLabel ?? '-');
const currentRefLabel = computed(() => selectedConflict.value?.currentLabel ?? '-');
const conflictStates = ref<Record<number, ConflictState>>({});

const {
  applyConflictAt: applyConflictAtAction,
  applyAllConflicts: applyAllConflictsAction,
  markConflictAsManual,
} = useMergeConflictActions({
  conflicts,
  conflictStates,
  resolvedConflicts,
  isApplyingAction,
  resultEditorRef: () => resultEditor,
  resultModelRef: () => resultModel,
  modifiedContentRef: () => props.modified || '',
  onAfterApply: () => {
    resultEditor?.focus();
    buildDecorations();
    renderConflictWidgets();
  },
});

function applyConflictAt(index: number, strategy: 'incoming' | 'current' | 'both' | 'base') {
  applyConflictAtAction(index, strategy);
  revealConflict(index);
}

function applyAllConflicts(strategy: 'incoming' | 'current') {
  applyAllConflictsAction(strategy);
}

function destroyConflictWidgets() {
  if (incomingEditor) {
    for (const widget of conflictWidgetsIncoming) incomingEditor.removeContentWidget(widget);
  }
  if (currentEditor) {
    for (const widget of conflictWidgetsCurrent) currentEditor.removeContentWidget(widget);
  }
  if (resultEditor) {
    for (const widget of conflictWidgetsResult) resultEditor.removeContentWidget(widget);
  }
  conflictWidgetsIncoming = [];
  conflictWidgetsCurrent = [];
  conflictWidgetsResult = [];
}

function destroyConflictZones() {
  incomingZoneIds = clearViewZones(incomingEditor, incomingZoneIds);
  currentZoneIds = clearViewZones(currentEditor, currentZoneIds);
  resultZoneIds = clearViewZones(resultEditor, resultZoneIds);
}

function disposeEditors() {
  destroyConflictWidgets();
  destroyConflictZones();
  disposeMonacoResources({
    incomingEditor,
    currentEditor,
    resultEditor,
    compareEditor,
    incomingModel,
    currentModel,
    baseModel,
    resultModel,
    subscriptions: editorSubscriptions,
  });

  incomingEditor = null;
  currentEditor = null;
  resultEditor = null;
  compareEditor = null;
  incomingModel = null;
  currentModel = null;
  baseModel = null;
  resultModel = null;
  editorSubscriptions = [];
}

function relayoutEditors() {
  incomingEditor?.layout();
  currentEditor?.layout();
  resultEditor?.layout();
  compareEditor?.layout();
}

function clampSplitters() {
  const width = workspaceContainer.value?.clientWidth ?? 0;
  const height = workspaceContainer.value?.clientHeight ?? 0;

  if (width > 0) {
    const minLeft = 220;
    const maxLeft = Math.max(minLeft, width - 220);
    if (leftPaneWidth.value <= 0) leftPaneWidth.value = Math.floor(width / 2);
    leftPaneWidth.value = Math.max(minLeft, Math.min(maxLeft, leftPaneWidth.value));
  }

  if (height > 0) {
    const minTop = 140;
    const maxTop = Math.max(minTop, height - 200);
    if (topPaneHeight.value <= 0) topPaneHeight.value = Math.floor(height * 0.55);
    topPaneHeight.value = Math.max(minTop, Math.min(maxTop, topPaneHeight.value));
  }
}

function buildDecorations() {
  if (!monaco.value || !incomingEditor || !currentEditor || !resultEditor) return;

  const newIncoming = conflicts.value.map((conflict) => ({
    range: new monaco.value.Range(conflict.startLine, 1, conflict.endLine, 1),
    options: {
      isWholeLine: true,
      className: 'merge-editor-block merge-editor-block-incoming',
      glyphMarginClassName: 'merge-editor-glyph merge-editor-glyph-incoming',
      minimap: { color: '#6cab4f66', position: monaco.value.editor.MinimapPosition.Inline },
      overviewRuler: { color: '#6cab4f99', position: monaco.value.editor.OverviewRulerLane.Full },
    },
  }));

  const newCurrent = conflicts.value.map((conflict) => ({
    range: new monaco.value.Range(conflict.startLine, 1, conflict.endLine, 1),
    options: {
      isWholeLine: true,
      className: 'merge-editor-block merge-editor-block-current',
      glyphMarginClassName: 'merge-editor-glyph merge-editor-glyph-current',
      minimap: { color: '#57b0ff66', position: monaco.value.editor.MinimapPosition.Inline },
      overviewRuler: { color: '#57b0ff99', position: monaco.value.editor.OverviewRulerLane.Full },
    },
  }));

  const newResult = conflicts.value.map((conflict, index) => ({
    range: new monaco.value.Range(conflict.startLine, 1, conflict.endLine, 1),
    options: {
      isWholeLine: true,
      className: index === selectedConflictIndex.value
        ? 'merge-editor-block merge-editor-block-selected'
        : 'merge-editor-block merge-editor-block-result',
      glyphMarginClassName: index === selectedConflictIndex.value
        ? 'merge-editor-glyph merge-editor-glyph-selected'
        : 'merge-editor-glyph merge-editor-glyph-result',
      minimap: { color: index === selectedConflictIndex.value ? '#f59e0b99' : '#f59e0b66', position: monaco.value.editor.MinimapPosition.Inline },
      overviewRuler: { color: index === selectedConflictIndex.value ? '#f59e0bcc' : '#f59e0b88', position: monaco.value.editor.OverviewRulerLane.Full },
    },
  }));

  incomingDecorations = incomingEditor.deltaDecorations(incomingDecorations, newIncoming);
  currentDecorations = currentEditor.deltaDecorations(currentDecorations, newCurrent);
  resultDecorations = resultEditor.deltaDecorations(resultDecorations, newResult);
}

function renderConflictZones() {
  if (!incomingEditor || !currentEditor || !resultEditor || conflicts.value.length === 0) {
    destroyConflictZones();
    return;
  }

  destroyConflictZones();

  incomingZoneIds = applyConflictViewZones(incomingEditor, conflicts.value, 22);
  currentZoneIds = applyConflictViewZones(currentEditor, conflicts.value, 22);
  resultZoneIds = applyConflictViewZones(resultEditor, conflicts.value, 22);
}

function renderConflictWidgets() {
  if (!incomingEditor || !currentEditor || !resultEditor || !monaco.value || conflicts.value.length === 0) {
    destroyConflictWidgets();
    return;
  }

  destroyConflictWidgets();
  conflictWidgetsIncoming = conflicts.value.map((conflict) => createSideConflictWidget({
    monaco: monaco.value,
    editor: incomingEditor,
    conflict,
    side: 'incoming',
    t,
    onApply: applyConflictAt,
  }));
  conflictWidgetsCurrent = conflicts.value.map((conflict) => createSideConflictWidget({
    monaco: monaco.value,
    editor: currentEditor,
    conflict,
    side: 'current',
    t,
    onApply: applyConflictAt,
  }));
  conflictWidgetsResult = conflicts.value.map((conflict) => createResultInfoWidget({
    monaco: monaco.value,
    editor: resultEditor,
    conflict,
    state: conflictStates.value[conflict.index] || 'none',
    onResetBase: (index) => applyConflictAt(index, 'base'),
  })).filter(Boolean);
}

function startSplitDrag(type: 'horizontal' | 'vertical', event: MouseEvent) {
  draggingSplit = type;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  dragStartLeft = leftPaneWidth.value;
  dragStartTop = topPaneHeight.value;
  event.preventDefault();
}

function stopSplitDrag() {
  draggingSplit = null;
}

function onSplitDrag(event: MouseEvent) {
  if (!draggingSplit) return;

  if (draggingSplit === 'horizontal') {
    leftPaneWidth.value = dragStartLeft + (event.clientX - dragStartX);
  } else {
    topPaneHeight.value = dragStartTop + (event.clientY - dragStartY);
  }

  clampSplitters();
}

function revealConflict(index: number) {
  if (!resultEditor || index < 0 || index >= conflicts.value.length) return;

  selectedConflictIndex.value = index;
  const line = conflicts.value[index].startLine;
  incomingEditor?.revealLineInCenter(line);
  currentEditor?.revealLineInCenter(line);
  resultEditor?.revealLineInCenter(line);
  resultEditor?.setPosition({ lineNumber: line, column: 1 });
  buildDecorations();
}

function ensureCompareEditor() {
  if (!monaco.value || !compareContainer.value || !baseModel) return;

  const modifiedTarget = compareTarget.value === 'incoming'
    ? incomingModel
    : compareTarget.value === 'current'
      ? currentModel
      : resultModel;
  if (!modifiedTarget) return;

  if (!compareEditor) {
    compareEditor = monaco.value.editor.createDiffEditor(compareContainer.value, {
      ...monacoOptions,
      theme: getMonacoTheme(currentTheme.value),
      renderSideBySide: true,
      readOnly: true,
      diffWordWrap: 'on',
      wordWrap: 'on',
    });
  }

  compareEditor.setModel({ original: baseModel, modified: modifiedTarget });
  compareEditor.layout();
}

function openCompareWithBase(target: 'incoming' | 'current' | 'result') {
  compareTarget.value = target;
  isComparingWithBase.value = true;
  nextTick(() => {
    ensureCompareEditor();
    relayoutEditors();
  });
}

function closeCompare() {
  isComparingWithBase.value = false;
  compareTarget.value = 'result';
  nextTick(relayoutEditors);
}

function resetResultEditor() {
  if (!resultModel) return;
  resultModel.setValue(initialResultText.value);
  resolvedConflicts.value = new Set();
  conflictStates.value = {};
  closeCompare();
  buildDecorations();
  renderConflictWidgets();
}

function moveConflict(direction: 'next' | 'prev') {
  if (conflicts.value.length === 0) return;
  const nextIndex = direction === 'next'
    ? Math.min(selectedConflictIndex.value + 1, conflicts.value.length - 1)
    : Math.max(selectedConflictIndex.value - 1, 0);
  revealConflict(nextIndex);
}

async function setupEditors() {
  if (!incomingContainer.value || !currentContainer.value || !resultContainer.value) return;

  monaco.value = await initMonaco();

  const language = getLanguage(props.filename);
  const parsed = parseConflicts(props.modified || '', {
    incomingFallbackLabel: t('changes.incoming'),
    currentFallbackLabel: t('changes.current'),
  });
  conflicts.value = parsed.conflicts;
  selectedConflictIndex.value = 0;
  resolvedConflicts.value = new Set();
  conflictStates.value = {};

  ({
    incomingModel,
    currentModel,
    baseModel,
    resultModel,
  } = createMergeModels(monaco.value, {
    incomingText: parsed.incomingText,
    currentText: parsed.currentText,
    baseText: props.original || '',
    resultText: parsed.resultText,
    language,
  }));
  initialResultText.value = parsed.resultText;
  lastSavedValue.value = parsed.resultText;
  isDirty.value = false;

  ({
    incomingEditor,
    currentEditor,
    resultEditor,
  } = createMergeEditors(monaco.value, {
    incomingContainer: incomingContainer.value,
    currentContainer: currentContainer.value,
    resultContainer: resultContainer.value,
    theme: getMonacoTheme(currentTheme.value),
    monacoOptions,
  }));

  bindModelsToEditors(
    { incomingEditor, currentEditor, resultEditor },
    { incomingModel, currentModel, baseModel, resultModel },
  );
  editorSubscriptions = setupScrollSync({ incomingEditor, currentEditor, resultEditor });
  editorSubscriptions.push(
    resultEditor.onDidScrollChange(() => updateVisibleBlame()),
    resultEditor.onDidLayoutChange(() => updateVisibleBlame()),
  );

  resultModel.onDidChangeContent((event: any) => {
    isDirty.value = resultModel.getValue() !== lastSavedValue.value;
    if (!isApplyingAction.value) {
      for (const ch of event?.changes || []) {
        const line = ch?.range?.startLineNumber ?? 0;
        markConflictAsManual(line);
      }
      renderConflictWidgets();
    }
    if (!isApplyingAction.value) buildDecorations();
  });

  resultEditor.addCommand(
    monaco.value.KeyMod.CtrlCmd | monaco.value.KeyCode.KeyS,
    () => {
      handleSave();
    },
  );

  buildDecorations();
  renderConflictZones();
  renderConflictWidgets();

  await nextTick();
  if (conflicts.value.length > 0) revealConflict(0);
  relayoutEditors();
  applyWordWrap();
  applyOnlyConflicts();
  if (showBlame.value) loadBlame();
  emitEditorState();
}

function handleSave() {
  if (!resultModel) return;
  const value = resultModel.getValue();
  emit('save', value);
  lastSavedValue.value = value;
  isDirty.value = false;
}

function handleCompleteMerge() {
  if (!resultModel) return;
  emit('complete', resultModel.getValue());
}

function emitEditorState() {
  emit('state', {
    remainingConflicts: remainingConflicts.value,
    canCompleteMerge: remainingConflicts.value === 0,
    isDirty: isDirty.value,
  });
}

defineExpose({
  completeMerge: handleCompleteMerge,
});

watch([() => props.modified, () => props.filename], async () => {
  disposeEditors();
  isComparingWithBase.value = false;
  compareTarget.value = 'result';
  await nextTick();
  setupEditors();
});

watch(currentTheme, (val) => {
  if (monaco.value) monaco.value.editor.setTheme(getMonacoTheme(val));
});

watch([remainingConflicts, isDirty], () => {
  emitEditorState();
});

watch([leftPaneWidth, topPaneHeight], async () => {
  await nextTick();
  relayoutEditors();
});

onMounted(() => {
  setupEditors();
  window.addEventListener('mousemove', onSplitDrag);
  window.addEventListener('mouseup', stopSplitDrag);

  resizeObserver = new ResizeObserver(() => {
    clampSplitters();
    relayoutEditors();
  });

  if (workspaceContainer.value) resizeObserver.observe(workspaceContainer.value);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onSplitDrag);
  window.removeEventListener('mouseup', stopSplitDrag);
  resizeObserver?.disconnect();
  resizeObserver = null;
  disposeEditors();
});
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#1E1E1E] merge-editor-root">
    <div class="shrink-0 bg-neutral-100 dark:bg-[#252526] border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center justify-between gap-3">
      <div class="min-w-0 flex items-center gap-1">
            <Tooltip :text="t('diff.word_wrap')">
              <button
                @click="isWordWrap = !isWordWrap"
                :class="[
                  'w-7 h-7 center rounded border transition-colors',
                  isWordWrap
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-500'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                ]"
              >
                <Icon icon="lucide:wrap-text" class="text-xs" />
              </button>
            </Tooltip>
            <Tooltip :text="t('changes.only_conflicts')">
              <button
                @click="onlyConflicts = !onlyConflicts"
                :disabled="totalConflicts === 0"
                :class="[
                  'w-7 h-7 center rounded border transition-colors disabled:opacity-30',
                  onlyConflicts
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                ]"
              >
                <Icon icon="lucide:list-filter" class="text-xs" />
              </button>
            </Tooltip>
            <Tooltip :text="t('diff.blame')">
              <button
                @click="showBlame = !showBlame"
                :disabled="!repoPath"
                :class="[
                  'w-7 h-7 center rounded border transition-colors disabled:opacity-30',
                  showBlame
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-500'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                ]"
              >
                <Icon icon="lucide:git-commit-vertical" class="text-xs" />
              </button>
            </Tooltip>
            <span
              v-if="isDirty"
              class="inline-flex w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 ml-1"
              :title="t('common.save')"
            />
          </div>

      <div class="flex items-center gap-2">
        <button
          @click="moveConflict('prev')"
          :disabled="totalConflicts <= 0 || selectedConflictIndex === 0"
          class="w-6 h-6 center rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100/60 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30"
        >
          <Icon icon="lucide:chevron-up" class="text-xs" />
        </button>
        <button
          @click="moveConflict('next')"
          :disabled="totalConflicts <= 0 || selectedConflictIndex >= totalConflicts - 1"
          class="w-6 h-6 center rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100/60 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white disabled:opacity-30"
        >
          <Icon icon="lucide:chevron-down" class="text-xs" />
        </button>

        <span class="text-[10px] text-neutral-600 dark:text-neutral-400 tabular-nums">
          {{ totalConflicts > 0 ? `${selectedConflictIndex + 1}/${totalConflicts}` : '0/0' }}
        </span>

        <Tooltip :text="t('common.save')">
          <button
            @click="handleSave"
            class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter text-white"
          >
            <Icon icon="lucide:save" class="text-xs" />
            <span>{{ t('common.save') }}</span>
          </button>
        </Tooltip>
      </div>
    </div>

    <div
      ref="workspaceContainer"
      class="flex-1 min-h-0 grid relative"
      :style="{ gridTemplateRows: `${topPaneHeight > 0 ? `${topPaneHeight}px` : '55%'} 6px 1fr` }"
    >
      <div
        class="min-h-0 grid border-b border-neutral-200 dark:border-neutral-800"
        :style="{ gridTemplateColumns: `${leftPaneWidth > 0 ? `${leftPaneWidth}px` : '1fr'} 6px 1fr` }"
      >
        <section class="min-h-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
          <header class="h-8 px-3 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/70">
            <div class="h-stack items-center gap-2 min-w-0">
              <span>{{ t('changes.incoming') }}</span>
              <span class="text-neutral-500 truncate max-w-[40%]">{{ incomingRefLabel }}</span>
            </div>
            <div class="h-stack items-center gap-1">
              <button
                @click="applyAllConflicts('incoming')"
                :disabled="totalConflicts <= 0"
                class="px-2 py-0.5 text-[9px] rounded border border-emerald-700/70 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40"
              >
                {{ t('changes.accept_all_incoming') }}
              </button>
              <button
                @click="openCompareWithBase('incoming')"
                class="px-2 py-0.5 text-[9px] rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70"
              >
                {{ t('changes.compare_with_base') }}
              </button>
            </div>
          </header>
          <div ref="incomingContainer" class="flex-1 min-h-0" />
        </section>

        <div
          class="w-1.5 h-full z-20 bg-transparent hover:bg-blue-500/40 cursor-col-resize"
          @mousedown="startSplitDrag('horizontal', $event)"
        />

        <section class="min-h-0 flex flex-col">
          <header class="h-8 px-3 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/70">
            <div class="h-stack items-center gap-2 min-w-0">
              <span>{{ t('changes.current') }}</span>
              <span class="text-neutral-500 truncate max-w-[40%]">{{ currentRefLabel }}</span>
            </div>
            <div class="h-stack items-center gap-1">
              <button
                @click="applyAllConflicts('current')"
                :disabled="totalConflicts <= 0"
                class="px-2 py-0.5 text-[9px] rounded border border-sky-700/70 text-sky-300 hover:bg-sky-900/30 disabled:opacity-40"
              >
                {{ t('changes.accept_all_current') }}
              </button>
              <button
                @click="openCompareWithBase('current')"
                class="px-2 py-0.5 text-[9px] rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70"
              >
                {{ t('changes.compare_with_base') }}
              </button>
            </div>
          </header>
          <div ref="currentContainer" class="flex-1 min-h-0" />
        </section>
      </div>

      <div
        class="h-1.5 w-full z-20 bg-transparent hover:bg-blue-500/40 cursor-row-resize"
        @mousedown="startSplitDrag('vertical', $event)"
      />

      <section class="min-h-0 flex flex-col">
        <header class="h-8 px-3 text-[11px] text-neutral-600 dark:text-neutral-400 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/70">
          <div class="h-stack items-center gap-2 min-w-0">
            <span>{{ t('changes.result') }}</span>
            <span class="text-neutral-500 truncate">{{ filename || t('changes.untitled') }}</span>
            <span
              v-if="isDirty"
              class="inline-flex w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
              :title="t('common.save')"
            />
          </div>
          <div class="h-stack items-center gap-2">
            <button
              v-if="isComparingWithBase"
              @click="closeCompare"
              class="px-2 py-0.5 text-[9px] rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/70"
            >
              {{ t('changes.back_to_editor') }}
            </button>
            <span class="text-neutral-500">{{ remainingConflicts }} {{ t('changes.conflicts_remaining') }}</span>
            <button
              @click="resetResultEditor"
              class="w-6 h-6 center rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100/60 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
              :title="t('changes.reset_result')"
            >
              <Icon icon="lucide:rotate-ccw" class="text-xs" />
            </button>
          </div>
        </header>
        <div v-show="!isComparingWithBase" class="flex-1 min-h-0 flex">
          <!-- Blame gutter (HEAD) next to the result editor -->
          <div v-if="showBlame" class="shrink-0 bg-neutral-50 dark:bg-[#181818] border-r border-neutral-200 dark:border-neutral-800 overflow-hidden relative select-none" :style="{ width: BLAME_WIDTH + 'px' }">
            <div v-if="isBlameLoading" class="absolute inset-0 center bg-white/70 dark:bg-[#181818]/70 z-10">
              <Icon icon="lucide:loader-2" class="animate-spin text-neutral-500" />
            </div>
            <div v-else-if="blameError" class="p-3 text-[10px] text-red-400 text-center opacity-70">{{ blameError }}</div>
            <div v-else class="absolute left-0 right-0 top-0 will-change-transform" :style="{ transform: `translateY(-${blameScrollTop}px)` }">
              <div v-for="vb in visibleBlame" :key="vb.line" class="absolute left-0 w-full h-stack px-1 group overflow-hidden" :style="{ top: vb.top + 'px', height: vb.height + 'px' }">
                <template v-if="vb.blame && vb.isNewCommit">
                  <div class="h-full w-full h-stack items-center border-t border-neutral-200/50 dark:border-neutral-800/50 -mt-px px-1 group-hover:bg-neutral-200/40 dark:group-hover:bg-neutral-800/40 transition-colors">
                    <Tooltip :text="`${vb.blame.author}\n${vb.blame.summary}`" position="right">
                      <img :src="gravatarUrl(vb.blame.email)" class="w-4 h-4 rounded-sm border border-neutral-300 dark:border-neutral-700 shrink-0 mr-2 cursor-help" />
                    </Tooltip>
                    <Tooltip :text="vb.blame.summary" position="right" class="flex-1 min-w-0 mr-1">
                      <span class="truncate text-[10px] font-mono text-neutral-600/80 dark:text-neutral-400/80">{{ vb.blame.summary }}</span>
                    </Tooltip>
                    <span class="text-[9px] font-mono opacity-40 shrink-0">{{ new Date(Number(vb.blame.time) * 1000).toLocaleDateString('en-GB') }}</span>
                  </div>
                </template>
                <div v-else-if="vb.blame" class="w-[2px] h-full bg-neutral-200/40 dark:bg-neutral-800/40 ml-[7px]"></div>
              </div>
            </div>
          </div>
          <div ref="resultContainer" class="flex-1 min-h-0 min-w-0" />
        </div>
        <div v-show="isComparingWithBase" ref="compareContainer" class="flex-1 min-h-0" />
      </section>
    </div>
  </div>
</template>

<style scoped>
:deep(.merge-editor-block) {
  border-left: 2px solid transparent;
}

:deep(.merge-editor-block-incoming) {
  background: rgba(110, 191, 81, 0.16);
  border-left-color: rgba(110, 191, 81, 0.95);
}

:deep(.merge-editor-block-current) {
  background: rgba(87, 176, 255, 0.16);
  border-left-color: rgba(87, 176, 255, 0.95);
}

:deep(.merge-editor-block-result) {
  background: rgba(245, 158, 11, 0.09);
  border-left-color: rgba(245, 158, 11, 0.65);
}

:deep(.merge-editor-block-selected) {
  background: rgba(245, 158, 11, 0.2);
  border-left-color: rgba(245, 158, 11, 1);
}

:deep(.merge-editor-glyph) {
  width: 6px !important;
  margin-left: 4px;
  border-radius: 999px;
}

:deep(.merge-editor-glyph-incoming) {
  background: rgba(110, 191, 81, 0.9);
}

:deep(.merge-editor-glyph-current) {
  background: rgba(87, 176, 255, 0.9);
}

:deep(.merge-editor-glyph-result) {
  background: rgba(245, 158, 11, 0.65);
}

:deep(.merge-editor-glyph-selected) {
  background: rgba(245, 158, 11, 1);
}

:deep(.merge-inline-zone) {
  height: 22px;
}

:deep(.merge-inline-actions) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  white-space: nowrap;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  pointer-events: auto;
}

:deep(.merge-inline-btn) {
  font-size: 9px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid transparent;
  background: rgba(22, 22, 22, 0.72);
  cursor: pointer;
}

:deep(.merge-inline-btn-incoming) {
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.5);
}

:deep(.merge-inline-btn-current) {
  color: #7dd3fc;
  border-color: rgba(14, 165, 233, 0.5);
}

:deep(.merge-inline-btn-both) {
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.55);
}

:deep(.merge-inline-btn-ignore) {
  color: #d4d4d8;
  border-color: rgba(161, 161, 170, 0.45);
}

:deep(.merge-inline-btn-manual) {
  color: #c4b5fd;
  border-color: rgba(167, 139, 250, 0.5);
}

:deep(.merge-inline-btn-reset) {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.55);
}

:deep(.merge-inline-btn-incoming:hover) {
  background: rgba(16, 185, 129, 0.18);
}

:deep(.merge-inline-btn-current:hover) {
  background: rgba(14, 165, 233, 0.18);
}

:deep(.merge-inline-btn-both:hover) {
  background: rgba(245, 158, 11, 0.18);
}

:deep(.merge-inline-btn-ignore:hover) {
  background: rgba(113, 113, 122, 0.18);
}

:deep(.merge-inline-btn-manual:hover) {
  background: rgba(167, 139, 250, 0.18);
}

:deep(.merge-inline-btn-reset:hover) {
  background: rgba(248, 113, 113, 0.18);
}

:deep(.merge-result-info) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

:deep(.merge-result-status) {
  font-size: 10px;
  color: #9ca3af;
  background: rgba(17, 24, 39, 0.55);
  border: 1px solid rgba(75, 85, 99, 0.55);
  border-radius: 3px;
  line-height: 1;
  padding: 3px 6px;
}
</style>

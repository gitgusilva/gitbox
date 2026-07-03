<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';
import Tooltip from './Tooltip.vue';
import { parseConflicts } from './merge-editor/conflictParser';
import type { ConflictBlock, ConflictState } from './merge-editor/types';
import { createResultInfoWidget } from './merge-editor/widgetFactory';
import { applyConflictViewZones, clearViewZones } from './merge-editor/viewZones';
import { bindModelsToEditors, createMergeEditors, createMergeModels, disposeMonacoResources, setupScrollSync } from './merge-editor/monacoRuntime';
import { useMergeConflictActions } from './merge-editor/useMergeConflictActions';
import { createSideConflictWidget } from './merge-editor/widgetFactory';
import { generalSettings } from '../../services/settingsService';
import { getItem, setItem } from '../../services/storageService';
import { gravatarUrl } from '../../utils/avatars';

/** Active merge layout: 'columns' (JetBrains 3-pane) or 'stacked' (classic). */
const mergeLayout = computed(() => generalSettings.value.mergeLayout ?? 'columns');

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

const currentWidth = ref(0);   // columns layout: current pane width
const incomingWidth = ref(0);  // columns layout: incoming pane width
const leftPaneWidth = ref(0);  // stacked layout: incoming pane width (top-left)
const topPaneHeight = ref(0);  // stacked layout: top row height
const isComparingWithBase = ref(false);
const compareTarget = ref<'incoming' | 'current' | 'result'>('result');
const initialResultText = ref('');
const resolvedConflicts = ref<Set<number>>(new Set());
const isApplyingAction = ref(false);
const lastSavedValue = ref('');
const isDirty = ref(false);
// Persisted view prefs so they survive reopening the merge editor / other screens.
const isWordWrap = ref(getItem('gitbox_merge_word_wrap') === 'true');
const onlyConflicts = ref(getItem('gitbox_merge_only_conflicts') === 'true');
const lineByLine = ref(getItem('gitbox_merge_line_by_line') === 'true');
watch(isWordWrap, (v) => setItem('gitbox_merge_word_wrap', v ? 'true' : 'false'));
watch(onlyConflicts, (v) => setItem('gitbox_merge_only_conflicts', v ? 'true' : 'false'));
watch(lineByLine, (v) => setItem('gitbox_merge_line_by_line', v ? 'true' : 'false'));

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
const showBlame = ref(getItem('gitbox_merge_blame') === 'true');
watch(showBlame, (v) => setItem('gitbox_merge_blame', v ? 'true' : 'false'));
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

// Scrolling over the blame gutter scrolls the result editor (blame follows).
function onBlameWheel(e: WheelEvent) {
  if (!resultEditor) return;
  resultEditor.setScrollTop(resultEditor.getScrollTop() + e.deltaY);
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

let draggingSplit: null | 'current' | 'incoming' | 'horizontal' | 'vertical' = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartCurrent = 0;
let dragStartIncoming = 0;
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

// --- Connector gutter (between the incoming & current panes) -----------------
// The two panes are line-aligned on conflicts and scroll-synced, so each
// conflict maps to a band spanning its line range in the middle gutter. The
// band colour follows the theme tokens and encodes the resolution state, so the
// connectors match the diff viewer's ribbons and Monaco's diff colours.
const GUTTER_W = 44; // connector gutter width (holds bands + accept arrows)
const CONNECTOR_HEADER_H = 32; // the h-8 pane header the gutter also spans
const hasConnectors = computed(() => conflicts.value.length > 0);

const STACK_GUTTER = 22;

// The same section/gutter elements are placed via grid-template-areas, so the
// two layouts share one DOM. Columns = JetBrains 3-pane (current | result |
// incoming) with a connector gutter each side; stacked = classic (incoming |
// current on top, result below).
const gridStyle = computed(() => {
  if (mergeLayout.value === 'stacked') {
    const l = leftPaneWidth.value > 0 ? `${leftPaneWidth.value}px` : '1fr';
    const t = topPaneHeight.value > 0 ? `${topPaneHeight.value}px` : '55%';
    return {
      gridTemplateColumns: `${l} ${STACK_GUTTER}px 1fr`,
      gridTemplateRows: `${t} 6px 1fr`,
      gridTemplateAreas: '"inc gm cur" "rz rz rz" "res res res"',
    };
  }
  const c = currentWidth.value > 0 ? `${currentWidth.value}px` : '1fr';
  const i = incomingWidth.value > 0 ? `${incomingWidth.value}px` : '1fr';
  return {
    gridTemplateColumns: `${c} ${GUTTER_W}px minmax(240px, 1fr) ${GUTTER_W}px ${i}`,
    gridTemplateRows: '1fr',
    gridTemplateAreas: '"cur gl res gr inc"',
  };
});

// Bézier connector ribbons (same shape as the diff viewer): each conflict maps
// to a filled curve joining its region in the two adjacent editors, so the
// different region heights (current N lines ↔ result 1 line) read correctly.
type Ribbon = { index: number; d: string; fill: string; stroke: string; arrowY: number };
const leftRibbons = ref<Ribbon[]>([]);   // columns: current → result
const rightRibbons = ref<Ribbon[]>([]);  // columns: result → incoming
const midRibbons = ref<Ribbon[]>([]);    // stacked: incoming → current

function connectorColor(state: ConflictState): string {
  switch (state) {
    case 'incoming': return 'rgb(var(--gb-added) / 0.22)';
    case 'current': return 'rgb(var(--gb-modified) / 0.22)';
    case 'both': return 'rgb(var(--gb-accent) / 0.2)';
    case 'base': return 'rgb(var(--gb-text-muted) / 0.18)';
    case 'manual': return 'rgb(var(--gb-accent) / 0.18)';
    default: return 'rgb(var(--gb-removed) / 0.2)'; // unresolved
  }
}
function connectorStroke(state: ConflictState): string {
  switch (state) {
    case 'incoming': return 'rgb(var(--gb-added) / 0.6)';
    case 'current': return 'rgb(var(--gb-modified) / 0.6)';
    case 'both': return 'rgb(var(--gb-accent) / 0.55)';
    case 'base': return 'rgb(var(--gb-text-muted) / 0.45)';
    case 'manual': return 'rgb(var(--gb-accent) / 0.45)';
    default: return 'rgb(var(--gb-removed) / 0.55)';
  }
}

function ribbonPath(w: number, lTop: number, lBot: number, rTop: number, rBot: number): string {
  const m = (w * 0.5).toFixed(1);
  return `M 0 ${lTop.toFixed(1)} C ${m} ${lTop.toFixed(1)}, ${m} ${rTop.toFixed(1)}, ${w} ${rTop.toFixed(1)}`
    + ` L ${w} ${rBot.toFixed(1)} C ${m} ${rBot.toFixed(1)}, ${m} ${lBot.toFixed(1)}, 0 ${lBot.toFixed(1)} Z`;
}

function computeRibbons(leftEd: any, rightEd: any, w: number): Ribbon[] {
  if (!leftEd || !rightEd || conflicts.value.length === 0) return [];
  const viewH = rightEd.getLayoutInfo().height;
  const H = CONNECTOR_HEADER_H;
  const out: Ribbon[] = [];
  for (const c of conflicts.value) {
    const lTop = leftEd.getTopForLineNumber(c.startLine) - leftEd.getScrollTop() + H;
    const lBot = leftEd.getTopForLineNumber(c.endLine + 1) - leftEd.getScrollTop() + H;
    const rTop = rightEd.getTopForLineNumber(c.startLine) - rightEd.getScrollTop() + H;
    const rBot = rightEd.getTopForLineNumber(c.endLine + 1) - rightEd.getScrollTop() + H;
    if (Math.max(lBot, rBot) < H - 8 || Math.min(lTop, rTop) > H + viewH + 8) continue;
    const state = conflictStates.value[c.index] ?? 'none';
    out.push({ index: c.index, d: ribbonPath(w, lTop, lBot, rTop, rBot), fill: connectorColor(state), stroke: connectorStroke(state), arrowY: (rTop + rBot) / 2 });
  }
  return out;
}

function updateConnectors() {
  if (mergeLayout.value === 'stacked') {
    midRibbons.value = computeRibbons(incomingEditor, currentEditor, STACK_GUTTER);
    leftRibbons.value = [];
    rightRibbons.value = [];
  } else {
    leftRibbons.value = computeRibbons(currentEditor, resultEditor, GUTTER_W);
    rightRibbons.value = computeRibbons(resultEditor, incomingEditor, GUTTER_W);
    midRibbons.value = [];
  }
}

watch([conflicts, conflictStates], () => nextTick(updateConnectors), { deep: true });

/** True when a source-editor line falls inside any conflict block. */
function lineInAnyConflict(line: number): boolean {
  return conflicts.value.some((c) => line >= c.startLine && line < c.endLine);
}

/** Insert a single line (from incoming/current) into the result at its cursor —
 *  the building block for line-by-line resolution. */
function sendLineToResult(text: string) {
  if (!resultEditor || !resultModel) return;
  const pos = resultEditor.getPosition() || { lineNumber: 1, column: 1 };
  resultEditor.executeEdits('merge-send-line', [{
    range: { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column },
    text: text + '\n',
    forceMoveMarkers: true,
  }]);
  resultEditor.setPosition({ lineNumber: pos.lineNumber + 1, column: 1 });
  resultEditor.focus();
}

// Line-by-line mode: track which source lines were already sent so a line can't
// be added to the result twice; sent lines are dimmed.
let sentIncomingLines = new Set<number>();
let sentCurrentLines = new Set<number>();
let incomingSentDec: string[] = [];
let currentSentDec: string[] = [];

function refreshSentDecorations() {
  if (!monaco.value) return;
  const mk = (lines: Set<number>) => [...lines].map((l) => ({
    range: new monaco.value.Range(l, 1, l, 1),
    options: { isWholeLine: true, className: 'merge-line-sent' },
  }));
  if (incomingEditor) incomingSentDec = incomingEditor.deltaDecorations(incomingSentDec, mk(sentIncomingLines));
  if (currentEditor) currentSentDec = currentEditor.deltaDecorations(currentSentDec, mk(sentCurrentLines));
}

/** When line-by-line is on, clicking a conflict line sends it to the result — once. */
function onSideLineClick(editor: any, model: any, side: 'incoming' | 'current', e: any) {
  if (!lineByLine.value || !monaco.value || !e?.target?.position) return;
  const MT = monaco.value.editor.MouseTargetType;
  const t = e.target.type;
  if (t !== MT.CONTENT_TEXT && t !== MT.CONTENT_EMPTY && t !== MT.GUTTER_LINE_NUMBERS && t !== MT.GUTTER_GLYPH_MARGIN) return;
  const line = e.target.position.lineNumber;
  if (!lineInAnyConflict(line)) return;
  const text = model.getLineContent(line);
  if (text === '') return; // skip the parser's padding lines
  const set = side === 'incoming' ? sentIncomingLines : sentCurrentLines;
  if (set.has(line)) return; // already added — no duplicates
  set.add(line);
  sendLineToResult(text);
  refreshSentDecorations();
}

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

  if (mergeLayout.value === 'stacked') {
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
    return;
  }

  if (width <= 0) return;
  const minCol = 180;
  const minResult = 240;
  const budget = width - GUTTER_W * 2 - minResult - minCol;
  const maxEach = Math.max(minCol, budget);
  if (currentWidth.value > 0) currentWidth.value = Math.max(minCol, Math.min(maxEach, currentWidth.value));
  if (incomingWidth.value > 0) incomingWidth.value = Math.max(minCol, Math.min(maxEach, incomingWidth.value));
}

function buildDecorations() {
  if (!monaco.value || !incomingEditor || !currentEditor || !resultEditor) return;

  const sendable = lineByLine.value ? ' merge-sendable' : '';
  const newIncoming = conflicts.value.map((conflict) => ({
    range: new monaco.value.Range(conflict.startLine, 1, conflict.endLine, 1),
    options: {
      isWholeLine: true,
      className: 'merge-editor-block merge-editor-block-incoming' + sendable,
      minimap: { color: '#6cab4f66', position: monaco.value.editor.MinimapPosition.Inline },
      overviewRuler: { color: '#6cab4f99', position: monaco.value.editor.OverviewRulerLane.Full },
    },
  }));

  const newCurrent = conflicts.value.map((conflict) => ({
    range: new monaco.value.Range(conflict.startLine, 1, conflict.endLine, 1),
    options: {
      isWholeLine: true,
      className: 'merge-editor-block merge-editor-block-current' + sendable,
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
  // Columns layout accepts via gutter arrows; the classic stacked layout keeps
  // the in-editor side accept widgets.
  if (mergeLayout.value === 'stacked') {
    conflictWidgetsIncoming = conflicts.value.map((conflict) => createSideConflictWidget({
      monaco: monaco.value, editor: incomingEditor, conflict, side: 'incoming', t, onApply: applyConflictAt,
    }));
    conflictWidgetsCurrent = conflicts.value.map((conflict) => createSideConflictWidget({
      monaco: monaco.value, editor: currentEditor, conflict, side: 'current', t, onApply: applyConflictAt,
    }));
  }
  conflictWidgetsResult = conflicts.value.map((conflict) => createResultInfoWidget({
    monaco: monaco.value,
    editor: resultEditor,
    conflict,
    state: conflictStates.value[conflict.index] || 'none',
    onResetBase: (index) => applyConflictAt(index, 'base'),
  })).filter(Boolean);
}

function startSplitDrag(side: 'current' | 'incoming' | 'horizontal' | 'vertical', event: MouseEvent) {
  const w = workspaceContainer.value?.clientWidth ?? 900;
  const thirds = Math.floor((w - GUTTER_W * 2) / 3);
  draggingSplit = side;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  // Seed fluid columns from the current third so the drag has a start width.
  dragStartCurrent = currentWidth.value > 0 ? currentWidth.value : thirds;
  dragStartIncoming = incomingWidth.value > 0 ? incomingWidth.value : thirds;
  if (side === 'current' || side === 'incoming') {
    currentWidth.value = dragStartCurrent;
    incomingWidth.value = dragStartIncoming;
  }
  dragStartLeft = leftPaneWidth.value;
  dragStartTop = topPaneHeight.value;
  event.preventDefault();
}

function stopSplitDrag() {
  draggingSplit = null;
}

function onSplitDrag(event: MouseEvent) {
  if (!draggingSplit) return;
  const dx = event.clientX - dragStartX;
  // Columns layout: left gutter grows current (drag right), right gutter grows
  // incoming (drag left). Stacked layout: horizontal = top-left width, vertical
  // = top row height. The result absorbs the difference.
  if (draggingSplit === 'current') currentWidth.value = dragStartCurrent + dx;
  else if (draggingSplit === 'incoming') incomingWidth.value = dragStartIncoming - dx;
  else if (draggingSplit === 'horizontal') leftPaneWidth.value = dragStartLeft + dx;
  else if (draggingSplit === 'vertical') topPaneHeight.value = dragStartTop + (event.clientY - dragStartY);
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

  // Fresh file → clear the line-by-line "already sent" tracking.
  sentIncomingLines = new Set();
  sentCurrentLines = new Set();
  incomingSentDec = [];
  currentSentDec = [];

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
    incomingEditor.onDidScrollChange(() => updateConnectors()),
    incomingEditor.onDidLayoutChange(() => updateConnectors()),
    // Line-by-line: when the toggle is on, click a conflict line to send it.
    incomingEditor.onMouseDown((e: any) => onSideLineClick(incomingEditor, incomingModel, 'incoming', e)),
    currentEditor.onMouseDown((e: any) => onSideLineClick(currentEditor, currentModel, 'current', e)),
  );
  nextTick(updateConnectors);

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

// Toggling line-by-line updates the "sendable" line highlight.
watch(lineByLine, () => buildDecorations());

watch(currentTheme, (val) => {
  if (monaco.value) monaco.value.editor.setTheme(getMonacoTheme(val));
});

watch([remainingConflicts, isDirty], () => {
  emitEditorState();
});

watch([currentWidth, incomingWidth, leftPaneWidth, topPaneHeight], async () => {
  await nextTick();
  relayoutEditors();
  updateConnectors();
});

// Switching layout re-arranges the grid and swaps the accept mechanism
// (gutter arrows vs in-editor side widgets); re-render and relayout.
watch(mergeLayout, async () => {
  await nextTick();
  clampSplitters();
  relayoutEditors();
  renderConflictWidgets();
  updateConnectors();
});

onMounted(() => {
  setupEditors();
  window.addEventListener('mousemove', onSplitDrag);
  window.addEventListener('mouseup', stopSplitDrag);

  resizeObserver = new ResizeObserver(() => {
    clampSplitters();
    relayoutEditors();
    updateConnectors();
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
  <div class="flex-1 min-h-0 flex flex-col bg-app merge-editor-root">
    <div class="shrink-0 bg-surface border-b border-line px-3 py-2 flex items-center justify-between gap-3">
      <div class="min-w-0 flex items-center gap-1">
            <Tooltip :text="t('diff.word_wrap')">
              <button
                @click="isWordWrap = !isWordWrap"
                :class="[
                  'w-7 h-7 center rounded border transition-colors',
                  isWordWrap
                    ? 'bg-accent/20 border-accent/40 text-accent'
                    : 'border-line-strong text-content-muted hover:text-content-strong'
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
                    : 'border-line-strong text-content-muted hover:text-content-strong'
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
                    ? 'bg-accent/20 border-accent/40 text-accent'
                    : 'border-line-strong text-content-muted hover:text-content-strong'
                ]"
              >
                <Icon icon="lucide:git-commit-vertical" class="text-xs" />
              </button>
            </Tooltip>
            <Tooltip :text="t('changes.line_by_line')">
              <button
                @click="lineByLine = !lineByLine"
                :class="[
                  'w-7 h-7 center rounded border transition-colors',
                  lineByLine
                    ? 'bg-accent/20 border-accent/40 text-accent'
                    : 'border-line-strong text-content-muted hover:text-content-strong'
                ]"
              >
                <Icon icon="lucide:list-plus" class="text-xs" />
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
          class="w-6 h-6 center rounded border border-line-strong bg-surface text-content hover:text-content-strong disabled:opacity-30"
        >
          <Icon icon="lucide:chevron-up" class="text-xs" />
        </button>
        <button
          @click="moveConflict('next')"
          :disabled="totalConflicts <= 0 || selectedConflictIndex >= totalConflicts - 1"
          class="w-6 h-6 center rounded border border-line-strong bg-surface text-content hover:text-content-strong disabled:opacity-30"
        >
          <Icon icon="lucide:chevron-down" class="text-xs" />
        </button>

        <span class="text-[10px] text-content-muted tabular-nums">
          {{ totalConflicts > 0 ? `${selectedConflictIndex + 1}/${totalConflicts}` : '0/0' }}
        </span>

        <Tooltip :text="t('common.save')">
          <button
            @click="handleSave"
            class="px-3 py-1 rounded bg-accent hover:bg-accent-hover transition-colors flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-tighter text-accent-fg"
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
      :style="gridStyle"
    >
      <!-- CURRENT (ours / local) -->
      <section class="min-h-0 flex flex-col min-w-0" style="grid-area: cur">
        <header class="h-8 px-3 text-[11px] text-content-muted flex items-center justify-between border-b border-line bg-surface">
          <div class="h-stack items-center gap-2 min-w-0">
            <span>{{ t('changes.current') }}</span>
            <span class="text-content-muted truncate max-w-[40%]">{{ currentRefLabel }}</span>
          </div>
          <div class="h-stack items-center gap-1 shrink-0">
            <Tooltip :text="t('changes.accept_all_current')">
              <button @click="applyAllConflicts('current')" :disabled="totalConflicts <= 0"
                      class="w-6 h-6 center rounded border border-modified/50 text-modified hover:bg-modified/10 disabled:opacity-40">
                <Icon icon="lucide:check-check" class="text-xs" />
              </button>
            </Tooltip>
            <Tooltip :text="t('changes.compare_with_base')">
              <button @click="openCompareWithBase('current')"
                      class="w-6 h-6 center rounded border border-line-strong text-content-muted hover:text-content hover:bg-surface-hover">
                <Icon icon="lucide:git-compare" class="text-xs" />
              </button>
            </Tooltip>
          </div>
        </header>
        <div ref="currentContainer" class="flex-1 min-h-0" />
      </section>

      <!-- LEFT gutter (columns): bands + accept current -> result -->
      <div v-if="mergeLayout === 'columns'" style="grid-area: gl" class="relative h-full z-20 bg-app border-x border-line cursor-col-resize"
           @mousedown="startSplitDrag('current', $event)">
        <svg class="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <path v-for="r in leftRibbons" :key="r.index" :d="r.d" :style="{ fill: r.fill, stroke: r.stroke }" stroke-width="1" />
        </svg>
        <button v-for="r in leftRibbons" :key="'a'+r.index"
                @mousedown.stop @click="applyConflictAt(r.index, 'current')"
                :title="t('changes.accept_all_current')"
                class="absolute left-1/2 -translate-x-1/2 w-5 h-5 center rounded-full bg-surface border border-line-strong text-content-muted hover:text-accent hover:border-accent shadow transition-colors"
                :style="{ top: (r.arrowY - 10) + 'px' }">
          <Icon icon="lucide:chevron-right" class="text-xs" />
        </button>
      </div>

      <!-- MIDDLE gutter (stacked): ribbons between incoming & current, + resize -->
      <div v-if="mergeLayout === 'stacked'" style="grid-area: gm" class="relative h-full z-20 cursor-col-resize"
           :class="hasConnectors ? 'bg-app border-x border-line' : 'bg-transparent hover:bg-accent/40'"
           @mousedown="startSplitDrag('horizontal', $event)">
        <svg class="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <path v-for="r in midRibbons" :key="r.index" :d="r.d" :style="{ fill: r.fill, stroke: r.stroke }" stroke-width="1" />
        </svg>
      </div>

      <!-- Row resizer (stacked): between the top panes and the result -->
      <div v-if="mergeLayout === 'stacked'" style="grid-area: rz"
           class="w-full h-1.5 z-20 bg-transparent hover:bg-accent/40 cursor-row-resize"
           @mousedown="startSplitDrag('vertical', $event)" />

      <!-- RESULT (middle, editable) -->
      <section class="min-h-0 flex flex-col min-w-0" style="grid-area: res">
        <header class="h-8 px-3 text-[11px] text-content-muted flex items-center justify-between border-b border-line bg-surface">
          <div class="h-stack items-center gap-2 min-w-0">
            <span>{{ t('changes.result') }}</span>
            <span class="text-content-muted truncate">{{ filename || t('changes.untitled') }}</span>
            <span v-if="isDirty" class="inline-flex w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" :title="t('common.save')" />
          </div>
          <div class="h-stack items-center gap-2">
            <button v-if="isComparingWithBase" @click="closeCompare"
                    class="px-2 py-0.5 text-[9px] rounded border border-line-strong text-content hover:bg-surface-hover">
              {{ t('changes.back_to_editor') }}
            </button>
            <span class="text-content-muted">{{ remainingConflicts }} {{ t('changes.conflicts_remaining') }}</span>
            <button @click="resetResultEditor" class="w-6 h-6 center rounded border border-line-strong bg-surface text-content hover:text-content-strong" :title="t('changes.reset_result')">
              <Icon icon="lucide:rotate-ccw" class="text-xs" />
            </button>
          </div>
        </header>
        <div v-show="!isComparingWithBase" class="flex-1 min-h-0 flex">
          <!-- Blame gutter (HEAD) next to the result editor -->
          <div v-if="showBlame" @wheel.prevent="onBlameWheel" class="shrink-0 bg-app border-r border-line overflow-hidden relative select-none" :style="{ width: BLAME_WIDTH + 'px' }">
            <div v-if="isBlameLoading" class="absolute inset-0 center bg-app/70 z-10">
              <Icon icon="lucide:loader-2" class="animate-spin text-content-muted" />
            </div>
            <div v-else-if="blameError" class="p-3 text-[10px] text-red-400 text-center opacity-70">{{ blameError }}</div>
            <div v-else class="absolute left-0 right-0 top-0 will-change-transform" :style="{ transform: `translateY(-${blameScrollTop}px)` }">
              <div v-for="vb in visibleBlame" :key="vb.line" class="absolute left-0 w-full h-stack px-1 group overflow-hidden" :style="{ top: vb.top + 'px', height: vb.height + 'px' }">
                <template v-if="vb.blame && vb.isNewCommit">
                  <div class="h-full w-full flex items-center gap-2 border-t border-line -mt-px px-1 group-hover:bg-surface-hover transition-colors overflow-hidden">
                    <Tooltip :text="`${vb.blame.author}\n${vb.blame.summary}`" position="right" class="shrink-0">
                      <img :src="gravatarUrl(vb.blame.email)" class="w-4 h-4 rounded-sm border border-line-strong shrink-0 cursor-help" />
                    </Tooltip>
                    <Tooltip :text="vb.blame.summary" position="right" class="flex-1 min-w-0 overflow-hidden">
                      <span class="block w-full truncate text-[10px] font-mono text-content-muted">{{ vb.blame.summary }}</span>
                    </Tooltip>
                    <span class="text-[9px] font-mono opacity-40 shrink-0 whitespace-nowrap tabular-nums">{{ new Date(Number(vb.blame.time) * 1000).toLocaleDateString('en-GB') }}</span>
                  </div>
                </template>
                <div v-else-if="vb.blame" class="w-[2px] h-full bg-line ml-[7px]"></div>
              </div>
            </div>
          </div>
          <div ref="resultContainer" class="flex-1 min-h-0 min-w-0" />
        </div>
        <div v-show="isComparingWithBase" ref="compareContainer" class="flex-1 min-h-0" />
      </section>

      <!-- RIGHT gutter (columns): ribbons + accept incoming -> result -->
      <div v-if="mergeLayout === 'columns'" style="grid-area: gr" class="relative h-full z-20 bg-app border-x border-line cursor-col-resize"
           @mousedown="startSplitDrag('incoming', $event)">
        <svg class="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <path v-for="r in rightRibbons" :key="r.index" :d="r.d" :style="{ fill: r.fill, stroke: r.stroke }" stroke-width="1" />
        </svg>
        <button v-for="r in rightRibbons" :key="'a'+r.index"
                @mousedown.stop @click="applyConflictAt(r.index, 'incoming')"
                :title="t('changes.accept_all_incoming')"
                class="absolute left-1/2 -translate-x-1/2 w-5 h-5 center rounded-full bg-surface border border-line-strong text-content-muted hover:text-accent hover:border-accent shadow transition-colors"
                :style="{ top: (r.arrowY - 10) + 'px' }">
          <Icon icon="lucide:chevron-left" class="text-xs" />
        </button>
      </div>

      <!-- INCOMING (theirs / remote) -->
      <section class="min-h-0 flex flex-col min-w-0" style="grid-area: inc">
        <header class="h-8 px-3 text-[11px] text-content-muted flex items-center justify-between border-b border-line bg-surface">
          <div class="h-stack items-center gap-2 min-w-0">
            <span>{{ t('changes.incoming') }}</span>
            <span class="text-content-muted truncate max-w-[40%]">{{ incomingRefLabel }}</span>
          </div>
          <div class="h-stack items-center gap-1 shrink-0">
            <Tooltip :text="t('changes.accept_all_incoming')">
              <button @click="applyAllConflicts('incoming')" :disabled="totalConflicts <= 0"
                      class="w-6 h-6 center rounded border border-added/50 text-added hover:bg-added/10 disabled:opacity-40">
                <Icon icon="lucide:check-check" class="text-xs" />
              </button>
            </Tooltip>
            <Tooltip :text="t('changes.compare_with_base')">
              <button @click="openCompareWithBase('incoming')"
                      class="w-6 h-6 center rounded border border-line-strong text-content-muted hover:text-content hover:bg-surface-hover">
                <Icon icon="lucide:git-compare" class="text-xs" />
              </button>
            </Tooltip>
          </div>
        </header>
        <div ref="incomingContainer" class="flex-1 min-h-0" />
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

/* Line-by-line mode: conflict lines are clickable (send to result); once sent,
   the line is dimmed and can't be sent again. */
:deep(.merge-sendable) {
  cursor: pointer;
}
:deep(.merge-sendable:hover) {
  filter: brightness(1.2);
  outline: 1px solid rgb(var(--gb-accent) / 0.5);
  outline-offset: -1px;
}
:deep(.merge-line-sent) {
  opacity: 0.4;
  text-decoration: line-through;
  text-decoration-color: rgb(var(--gb-text-muted) / 0.6);
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

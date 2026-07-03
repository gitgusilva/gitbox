<script setup lang="ts">
/**
 * JetBrains / GitEmber-style side-by-side diff.
 *
 * Two scroll-synced Monaco editors (original on the left, modified on the right)
 * separated by a dedicated connector gutter. Changed hunks are highlighted on
 * each side and linked across the gutter with filled Bézier ribbons whose colour
 * encodes the change kind (green = added, red = removed, blue = modified).
 *
 * Unchanged regions are kept vertically aligned by inserting blank view-zone
 * "spacers" on the shorter side of every hunk, exactly like a real diff view —
 * the ribbon bridges the height difference of the hunk itself.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { diffLines } from 'diff';
import { useTheme } from '../../services/themeService';
import { getLanguage, getMonacoTheme, monacoOptions, initMonaco } from '../../services/monacoService';

const props = withDefaults(defineProps<{
  original: string;
  modified: string;
  filename?: string;
  ignoreWhitespace?: boolean;
  wordWrap?: boolean;
  /** Show the Bézier connector gutter; when false, just a thin divider (two plain editors). */
  connectors?: boolean;
}>(), { connectors: true });

const { currentTheme } = useTheme();

const GUTTER_WIDTH = 48;

/** One changed hunk mapped to line ranges on each side (count 0 = pure add/remove). */
type DiffBlock = {
  type: 'added' | 'removed' | 'modified';
  leftStart: number;
  leftCount: number;
  rightStart: number;
  rightCount: number;
};

/** A drawn ribbon in gutter-local pixel coordinates. */
type Ribbon = { key: number; d: string; fill: string; stroke: string };

const leftContainer = ref<HTMLElement | null>(null);
const rightContainer = ref<HTMLElement | null>(null);
const rootEl = ref<HTMLElement | null>(null);
const ribbons = ref<Ribbon[]>([]);
// Wide gutter for the ribbons, or a hairline divider when connectors are off.
const gutterWidth = computed(() => (props.connectors ? GUTTER_WIDTH : 1));

let monaco: any = null;
let leftEditor: any = null;
let rightEditor: any = null;
let leftModel: any = null;
let rightModel: any = null;
let leftDecorations: string[] = [];
let rightDecorations: string[] = [];
let leftZoneIds: string[] = [];
let rightZoneIds: string[] = [];
let subscriptions: any[] = [];
let resizeObserver: ResizeObserver | null = null;
let lineHeight = 18;
let syncing = false;
let rafId: number | null = null;

let blocks: DiffBlock[] = [];
let selectedBlock = 0;

// Ribbon colours follow the theme tokens (same green/red/blue Monaco uses for
// added/removed/modified), so the connectors match the editors in every theme.
const COLORS = {
  added: { fill: 'rgb(var(--gb-added) / 0.20)', stroke: 'rgb(var(--gb-added) / 0.6)' },
  removed: { fill: 'rgb(var(--gb-removed) / 0.20)', stroke: 'rgb(var(--gb-removed) / 0.6)' },
  modified: { fill: 'rgb(var(--gb-modified) / 0.18)', stroke: 'rgb(var(--gb-modified) / 0.55)' },
};

/** Split the two texts into aligned hunks + the spacers needed to re-align. */
function computeDiff(): { blocks: DiffBlock[]; leftSpacers: Array<{ after: number; lines: number }>; rightSpacers: Array<{ after: number; lines: number }> } {
  const parts = diffLines(props.original ?? '', props.modified ?? '', {
    ignoreWhitespace: !!props.ignoreWhitespace,
  });

  const result: DiffBlock[] = [];
  const leftSpacers: Array<{ after: number; lines: number }> = [];
  const rightSpacers: Array<{ after: number; lines: number }> = [];

  let leftLine = 1;
  let rightLine = 1;
  let i = 0;

  while (i < parts.length) {
    const p = parts[i];
    if (!p.added && !p.removed) {
      leftLine += p.count ?? 0;
      rightLine += p.count ?? 0;
      i++;
      continue;
    }

    const leftStart = leftLine;
    const rightStart = rightLine;
    let removed = 0;
    let added = 0;

    if (p.removed) {
      removed = p.count ?? 0;
      i++;
      if (i < parts.length && parts[i].added) {
        added = parts[i].count ?? 0;
        i++;
      }
    } else {
      added = p.count ?? 0;
      i++;
    }

    const type: DiffBlock['type'] = removed > 0 && added > 0 ? 'modified' : (added > 0 ? 'added' : 'removed');
    result.push({ type, leftStart, leftCount: removed, rightStart, rightCount: added });

    leftLine += removed;
    rightLine += added;

    // Pad the shorter side so the following unchanged region lines back up.
    const delta = removed - added;
    if (delta > 0) rightSpacers.push({ after: rightStart + added - 1, lines: delta });
    else if (delta < 0) leftSpacers.push({ after: leftStart + removed - 1, lines: -delta });
  }

  return { blocks: result, leftSpacers, rightSpacers };
}

function applySpacers(editor: any, spacers: Array<{ after: number; lines: number }>, prevIds: string[]): string[] {
  let ids: string[] = [];
  editor.changeViewZones((accessor: any) => {
    for (const id of prevIds) accessor.removeZone(id);
    for (const s of spacers) {
      const dom = document.createElement('div');
      dom.className = 'rdiff-spacer';
      ids.push(accessor.addZone({
        afterLineNumber: Math.max(0, s.after),
        heightInLines: s.lines,
        domNode: dom,
      }));
    }
  });
  return ids;
}

function decorate(editor: any, side: 'left' | 'right', prev: string[]): string[] {
  const decos = blocks
    .map((b) => {
      const start = side === 'left' ? b.leftStart : b.rightStart;
      const count = side === 'left' ? b.leftCount : b.rightCount;
      if (count <= 0) return null;
      return {
        range: new monaco.Range(start, 1, start + count - 1, 1),
        options: {
          isWholeLine: true,
          className: `rdiff-line rdiff-line-${b.type}`,
          marginClassName: `rdiff-line rdiff-line-${b.type}`,
        },
      };
    })
    .filter(Boolean);
  return editor.deltaDecorations(prev, decos);
}

/** Top/bottom Y of a line range in gutter coordinates (accounts for scroll + zones). */
function blockEdges(editor: any, start: number, count: number): [number, number] {
  const scroll = editor.getScrollTop();
  if (count <= 0) {
    const y = editor.getTopForLineNumber(start) - scroll;
    return [y, y];
  }
  const top = editor.getTopForLineNumber(start) - scroll;
  const bottom = editor.getTopForLineNumber(start + count - 1) + lineHeight - scroll;
  return [top, bottom];
}

function scheduleDraw() {
  if (rafId != null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    drawRibbons();
  });
}

function drawRibbons() {
  if (!props.connectors) { ribbons.value = []; return; }
  if (!leftEditor || !rightEditor || !rootEl.value) return;
  const w = gutterWidth.value;
  const h = rootEl.value.clientHeight;
  const midA = w * 0.5;
  const midB = w * 0.5;

  const next: Ribbon[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const [lTop, lBottom] = blockEdges(leftEditor, b.leftStart, b.leftCount);
    const [rTop, rBottom] = blockEdges(rightEditor, b.rightStart, b.rightCount);

    // Skip ribbons entirely outside the viewport.
    if (Math.max(lBottom, rBottom) < -8 || Math.min(lTop, rTop) > h + 8) continue;

    const c = COLORS[b.type];
    const d = [
      `M 0 ${lTop.toFixed(1)}`,
      `C ${midA.toFixed(1)} ${lTop.toFixed(1)}, ${midB.toFixed(1)} ${rTop.toFixed(1)}, ${w} ${rTop.toFixed(1)}`,
      `L ${w} ${rBottom.toFixed(1)}`,
      `C ${midB.toFixed(1)} ${rBottom.toFixed(1)}, ${midA.toFixed(1)} ${lBottom.toFixed(1)}, 0 ${lBottom.toFixed(1)}`,
      'Z',
    ].join(' ');
    next.push({ key: i, d, fill: c.fill, stroke: c.stroke });
  }
  ribbons.value = next;
}

function syncScroll(source: any) {
  if (syncing) return;
  syncing = true;
  const other = source === leftEditor ? rightEditor : leftEditor;
  other.setScrollTop(source.getScrollTop());
  other.setScrollLeft(source.getScrollLeft());
  syncing = false;
  scheduleDraw();
}

function buildDiff() {
  if (!leftEditor || !rightEditor || !monaco) return;

  const { blocks: b, leftSpacers, rightSpacers } = computeDiff();
  blocks = b;
  selectedBlock = 0;

  leftZoneIds = applySpacers(leftEditor, leftSpacers, leftZoneIds);
  rightZoneIds = applySpacers(rightEditor, rightSpacers, rightZoneIds);
  leftDecorations = decorate(leftEditor, 'left', leftDecorations);
  rightDecorations = decorate(rightEditor, 'right', rightDecorations);

  nextTick(scheduleDraw);
}

async function setup() {
  if (!leftContainer.value || !rightContainer.value) return;
  monaco = await initMonaco();

  const language = getLanguage(props.filename);
  leftModel = monaco.editor.createModel(props.original ?? '', language);
  rightModel = monaco.editor.createModel(props.modified ?? '', language);

  const opts = {
    ...monacoOptions,
    theme: getMonacoTheme(currentTheme.value),
    readOnly: true,
    renderLineHighlight: 'none',
    wordWrap: props.wordWrap ? 'on' : 'off',
    scrollBeyondLastLine: false,
    scrollbar: { ...monacoOptions.scrollbar, alwaysConsumeMouseWheel: false },
  };

  leftEditor = monaco.editor.create(leftContainer.value, opts);
  rightEditor = monaco.editor.create(rightContainer.value, opts);
  leftEditor.setModel(leftModel);
  rightEditor.setModel(rightModel);

  lineHeight = leftEditor.getOption(monaco.editor.EditorOption.lineHeight) || 18;

  subscriptions.push(
    leftEditor.onDidScrollChange(() => syncScroll(leftEditor)),
    rightEditor.onDidScrollChange(() => syncScroll(rightEditor)),
    leftEditor.onDidLayoutChange(() => scheduleDraw()),
  );

  buildDiff();
  relayout();
}

function relayout() {
  leftEditor?.layout();
  rightEditor?.layout();
  scheduleDraw();
}

function dispose() {
  for (const s of subscriptions) s?.dispose?.();
  subscriptions = [];
  if (leftEditor) { leftZoneIds = []; leftEditor.dispose(); leftEditor = null; }
  if (rightEditor) { rightZoneIds = []; rightEditor.dispose(); rightEditor = null; }
  if (leftModel) { leftModel.dispose(); leftModel = null; }
  if (rightModel) { rightModel.dispose(); rightModel = null; }
}

/** Toolbar navigation: reveal the next/previous changed hunk on both sides. */
function goToChange(direction: 'next' | 'previous') {
  if (!blocks.length || !leftEditor || !rightEditor) return;
  selectedBlock = direction === 'next'
    ? Math.min(selectedBlock + 1, blocks.length - 1)
    : Math.max(selectedBlock - 1, 0);
  const b = blocks[selectedBlock];
  rightEditor.revealLineInCenter(Math.max(1, b.rightStart));
  leftEditor.revealLineInCenter(Math.max(1, b.leftStart));
  scheduleDraw();
}

defineExpose({ goToChange });

watch([() => props.original, () => props.modified, () => props.ignoreWhitespace], () => {
  if (!monaco || !leftEditor) return;
  const language = getLanguage(props.filename);
  leftModel.setValue(props.original ?? '');
  rightModel.setValue(props.modified ?? '');
  monaco.editor.setModelLanguage(leftModel, language);
  monaco.editor.setModelLanguage(rightModel, language);
  buildDiff();
});

watch(() => props.connectors, () => nextTick(() => relayout()));

watch(() => props.wordWrap, (val) => {
  const w = val ? 'on' : 'off';
  leftEditor?.updateOptions({ wordWrap: w });
  rightEditor?.updateOptions({ wordWrap: w });
  nextTick(scheduleDraw);
});

watch(currentTheme, (val) => {
  if (monaco) monaco.editor.setTheme(getMonacoTheme(val));
});

onMounted(() => {
  setup();
  resizeObserver = new ResizeObserver(() => relayout());
  if (rootEl.value) resizeObserver.observe(rootEl.value);
});

onBeforeUnmount(() => {
  if (rafId != null) cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
  resizeObserver = null;
  dispose();
});
</script>

<template>
  <div ref="rootEl" class="flex-1 min-h-0 min-w-0 flex relative overflow-hidden">
    <div ref="leftContainer" class="flex-1 min-w-0 h-full"></div>

    <!-- Connector gutter: Bézier ribbons linking each hunk across the two panes -->
    <div
      class="shrink-0 h-full relative bg-app border-x border-line"
      :style="{ width: gutterWidth + 'px' }"
    >
      <svg v-if="connectors" class="absolute inset-0 w-full h-full pointer-events-none" :width="gutterWidth" preserveAspectRatio="none">
        <path
          v-for="r in ribbons"
          :key="r.key"
          :d="r.d"
          :style="{ fill: r.fill, stroke: r.stroke }"
          stroke-width="1"
        />
      </svg>
    </div>

    <div ref="rightContainer" class="flex-1 min-w-0 h-full"></div>
  </div>
</template>

<style scoped>
:deep(.rdiff-line-added) { background: rgb(var(--gb-added) / 0.14); }
:deep(.rdiff-line-removed) { background: rgb(var(--gb-removed) / 0.14); }
:deep(.rdiff-line-modified) { background: rgb(var(--gb-modified) / 0.12); }
:deep(.rdiff-spacer) { background: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(120, 120, 120, 0.06) 5px, rgba(120, 120, 120, 0.06) 10px); }
</style>

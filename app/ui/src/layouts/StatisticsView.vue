<script setup lang="ts">
import { humanBytes } from '../utils/formatters';
import { computed, ref, watch } from 'vue';
import { useElementSize, useDebounceFn, useVirtualList } from '@vueuse/core';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import VueApexChart from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { repoPath, activeTab } from '../services/gitService';
import { useTheme, activeTheme } from '../services/themeService';
import { gravatarUrl } from '../utils/avatars';
import type { GitStatistics, StatMonth } from '../types/git';
import ScrollArea from '../components/Common/ScrollArea.vue';
import Tooltip from '../components/Common/Tooltip.vue';
import ChartPanel from '../components/Statistics/ChartPanel.vue';
import SegmentedToggle from '../components/Statistics/SegmentedToggle.vue';
import AuthorFilter from '../components/Statistics/AuthorFilter.vue';

const { t } = useI18n();
const { currentTheme } = useTheme();

// Responsiveness is driven by the PANEL width (not the viewport), so the layout
// reflows correctly even when the window is wide but the panel is squeezed.
const rootEl = ref<HTMLElement | null>(null);
const { width } = useElementSize(rootEl);

// Cards: default 3 per row for readability, collapsing to 2 / 1 when narrow.
const cardCols = computed(() => (width.value < 480 ? 1 : width.value < 760 ? 2 : 3));
// Pie + summary sit side by side only on a comfortably wide panel.
const pieSummaryTwoCol = computed(() => width.value >= 980);
// Activity + weekday pair up a bit earlier.
const dualChartTwoCol = computed(() => width.value >= 760);
const gridCols = (n: number) => `repeat(${n}, minmax(0, 1fr))`;

// ApexCharts only auto-reflows on window resize; nudge it when the panel (not the
// window) changes width so every chart refits its container.
const reflowCharts = useDebounceFn(() => window.dispatchEvent(new Event('resize')), 120);
watch(width, () => reflowCharts());

// Tailwind darkMode:'class' — the html.dark class is the source of truth; touching
// currentTheme keeps this reactive when the theme is toggled.
const isDark = computed(() => {
  void currentTheme.value;
  return document.documentElement.classList.contains('dark');
});

// Chart colors are driven by the active theme's tokens, so charts retint with it.
const tc = computed(() => activeTheme.value.colors);

const PALETTE = [
  '#ef4444', '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
  '#a855f7', '#ec4899', '#f97316', '#14b8a6', '#8b5cf6',
  '#84cc16', '#f43f5e',
];

const DEPTH_OPTIONS = [3, 6, 12, 24, 0]; // 0 = all history
const depth = ref(12);
const stats = ref<GitStatistics | null>(null);
const loading = ref(false);
const errorMsg = ref<string | null>(null);

const hasData = computed(() => !!stats.value && (stats.value.authors.length > 0 || stats.value.totalCommits > 0));

async function compute() {
  if (!repoPath.value) return;
  loading.value = true;
  errorMsg.value = null;
  try {
    stats.value = await window.gitbox.statistics(repoPath.value, depth.value);
  } catch (e: any) {
    errorMsg.value = e?.message || String(e);
    stats.value = null;
  } finally {
    loading.value = false;
  }
}

// Auto-compute when the tab is opened / the repo changes, but only once per repo
// until the user explicitly recomputes with a different depth.
let loadedFor = '';
watch([activeTab, repoPath], () => {
  if (activeTab.value === 'statistics' && repoPath.value && repoPath.value !== loadedFor) {
    loadedFor = repoPath.value;
    compute();
  }
}, { immediate: true });

function recompute() {
  loadedFor = repoPath.value || '';
  compute();
}

// ---- Derived data ----------------------------------------------------------

const authors = computed(() => stats.value?.authors ?? []);
const colorForIndex = (i: number) => PALETTE[i % PALETTE.length];

// Charts key their per-author data by display name, so a name always keeps the
// same swatch no matter which chart (or which filter) it shows up in.
const authorRank = computed(() => {
  const m = new Map<string, number>();
  authors.value.forEach((a, i) => { if (!m.has(a.name)) m.set(a.name, i); });
  return m;
});
const colorForAuthor = (name: string) => colorForIndex(authorRank.value.get(name) ?? 0);
const authorOptions = computed(() =>
  [...authorRank.value.keys()].map(name => ({ name, color: colorForAuthor(name) })));

// Top authors drive the unfiltered pie + stacked bar; the long tail is bucketed.
const TOP_N = 6;
const topAuthors = computed(() => authors.value.slice(0, TOP_N));
const tailAuthors = computed(() => authors.value.slice(TOP_N));

const fmt = (n: number) => (n ?? 0).toLocaleString();

const overviewCards = computed(() => {
  const s = stats.value;
  if (!s) return [];
  return [
    { key: 'commits', icon: 'lucide:git-commit-horizontal', label: t('stats.commits'), value: fmt(s.totalCommits), color: 'text-accent' },
    { key: 'contributors', icon: 'lucide:users', label: t('stats.contributors'), value: fmt(authors.value.length), color: 'text-added' },
    { key: 'branches', icon: 'lucide:git-branch', label: t('stats.branches'), value: fmt(s.branchCount), color: 'text-purple-400' },
    { key: 'tags', icon: 'lucide:tag', label: t('stats.tags'), value: fmt(s.tagCount), color: 'text-modified' },
    { key: 'size', icon: 'lucide:database', label: t('stats.size'), value: humanBytes(s.sizeBytes), color: 'text-cyan-400' },
    { key: 'churn', icon: 'lucide:diff', label: t('stats.churn'), value: `+${fmt(s.totalAdded)} / -${fmt(s.totalDeleted)}`, color: 'text-content-muted' },
  ];
});

// ---- Chart theming ---------------------------------------------------------

const baseChart = computed(() => ({
  foreColor: tc.value.textMuted,
  fontFamily: 'inherit',
  toolbar: { show: false },
  animations: { enabled: true, speed: 300 },
  background: 'transparent',
}));
const gridColor = computed(() => tc.value.border);
const tooltipTheme = computed(() => (isDark.value ? 'dark' : 'light'));

// ---- Shared filter vocabulary ----------------------------------------------
// Every chart keeps its own copy of these refs: narrowing one chart never
// touches another, which is the whole point of per-chart filters.

const METRIC_OPTIONS = computed(() => [
  { value: 'lines', label: t('stats.lines') },
  { value: 'commits', label: t('stats.commits') },
]);
const TOP_OPTIONS = computed(() => [
  { value: 5, label: t('stats.top_n', { n: 5 }) },
  { value: 10, label: t('stats.top_n', { n: 10 }) },
  { value: 0, label: t('stats.all') },
]);
const RANGE_OPTIONS = computed(() => [
  { value: 3, label: t('stats.n_months_short', { n: 3 }) },
  { value: 6, label: t('stats.n_months_short', { n: 6 }) },
  { value: 12, label: t('stats.n_months_short', { n: 12 }) },
  { value: 0, label: t('stats.all') },
]);

const allMonths = computed<StatMonth[]>(() => stats.value?.monthly ?? []);
/** Trailing window of the loaded months; 0 keeps everything the depth returned. */
const monthsInRange = (range: number) => (range > 0 ? allMonths.value.slice(-range) : allMonths.value);

const linesIn = (m: StatMonth, name: string) => m.byAuthor[name] || 0;
const commitsIn = (m: StatMonth, name: string) => m.commitsByAuthor?.[name] || 0;

// ---- Pie: contribution share ----------------------------------------------

const shareMetric = ref<'lines' | 'commits'>('lines');
const shareTop = ref(5);

const shareValue = (a: { lines: number; commits: number }) =>
  (shareMetric.value === 'lines' ? a.lines : a.commits);

const shareRanked = computed(() => {
  const list = [...authors.value];
  if (shareMetric.value === 'commits') list.sort((x, y) => y.commits - x.commits);
  return list;
});
const shareHead = computed(() => (shareTop.value > 0 ? shareRanked.value.slice(0, shareTop.value) : shareRanked.value));
const shareTail = computed(() => (shareTop.value > 0 ? shareRanked.value.slice(shareTop.value) : []));

const pieSeries = computed(() => {
  const head = shareHead.value.map(shareValue);
  const tail = shareTail.value.reduce((s, a) => s + shareValue(a), 0);
  return tail > 0 ? [...head, tail] : head;
});
const pieOptions = computed<ApexOptions>(() => {
  const hasTail = shareTail.value.length > 0 && shareTail.value.some(a => shareValue(a) > 0);
  const labels = shareHead.value.map((a) => a.name);
  if (hasTail) labels.push(t('stats.other'));
  const colors = shareHead.value.map((a) => colorForAuthor(a.name));
  if (hasTail) colors.push(tc.value.textMuted);
  const total = pieSeries.value.reduce((s, v) => s + v, 0) || 1;
  const unit = shareMetric.value === 'lines' ? t('stats.lines_lc') : t('stats.commits_lc');
  return {
    chart: { ...baseChart.value, type: 'donut' },
    labels,
    colors,
    stroke: { width: 0 },
    legend: {
      position: width.value < 640 ? 'bottom' : 'right',
      fontSize: '12px',
      itemMargin: { vertical: 3 },
      formatter: (name: string, opts: any) => {
        const val = opts.w.globals.series[opts.seriesIndex] || 0;
        return `${name}&nbsp;&nbsp;${((val / total) * 100).toFixed(1)}%`;
      },
      labels: { colors: tc.value.text },
    },
    dataLabels: { enabled: false },
    tooltip: { theme: tooltipTheme.value, y: { formatter: (v: number) => `${fmt(v)} ${unit}` } },
    plotOptions: { pie: { donut: { size: '62%', labels: { show: false } } } },
    states: { hover: { filter: { type: 'lighten', value: 0.08 } } },
  };
});

// ---- Summary table ---------------------------------------------------------

const summaryQuery = ref('');
const summarySort = ref<'lines' | 'commits' | 'avg' | 'name'>('lines');
const summaryDesc = ref(true);

const SUMMARY_SORT_OPTIONS = computed(() => [
  { value: 'lines', label: t('stats.lines') },
  { value: 'commits', label: t('stats.commits') },
  { value: 'avg', label: t('stats.avg') },
  { value: 'name', label: t('stats.developer') },
]);

const summaryAuthors = computed(() => {
  const q = summaryQuery.value.trim().toLowerCase();
  const rows = q
    ? authors.value.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    : [...authors.value];
  // The comparators below are written largest-first, so descending is the
  // identity direction and ascending is the one that flips them.
  const dir = summaryDesc.value ? 1 : -1;
  const key = summarySort.value;
  return rows.sort((x, y) => {
    if (key === 'name') return dir * y.name.localeCompare(x.name);
    if (key === 'commits') return dir * (y.commits - x.commits);
    if (key === 'avg') return dir * (y.avgLinesPerCommit - x.avgLinesPerCommit);
    return dir * (y.lines - x.lines);
  });
});

// The summary can hold thousands of contributors, so it's virtualized: only the
// visible rows render (and only their avatars are requested). Charts are safe —
// they bucket everyone beyond the top few into a single "Other" slice/series.
// The avg column needs room for a header as long as "Média/Commit", otherwise it
// collides with the Lines heading next to it.
const SUMMARY_COLS = '1fr 58px 78px 92px';
const SUMMARY_ROW_H = 34;
const {
  list: virtualAuthors,
  containerProps: summaryContainerProps,
  wrapperProps: summaryWrapperProps,
} = useVirtualList(summaryAuthors, { itemHeight: SUMMARY_ROW_H, overscan: 8 });

// ---- Stacked bar: monthly contributions -----------------------------------

const monthlyMetric = ref<'lines' | 'commits'>('lines');
const monthlyRange = ref(0);
const monthlyAuthors = ref<string[]>([]);

const monthlyMonths = computed(() => monthsInRange(monthlyRange.value));
const monthCategories = computed(() => monthlyMonths.value.map((m) => m.month));

const monthlySeries = computed(() => {
  const months = monthlyMonths.value;
  const value = monthlyMetric.value === 'lines' ? linesIn : commitsIn;

  // Explicit picks win: one series per selected contributor.
  if (monthlyAuthors.value.length > 0) {
    return monthlyAuthors.value.map((name) => ({ name, data: months.map((m) => value(m, name)) }));
  }
  // Commits metric with nobody picked: a single series of monthly totals.
  if (monthlyMetric.value === 'commits') {
    return [{ name: t('stats.commits'), data: months.map((m) => m.commits) }];
  }
  // Lines metric: one stacked series per top author + a bucketed "Other".
  const result = topAuthors.value.map((a) => ({
    name: a.name,
    data: months.map((m) => linesIn(m, a.name)),
  }));
  const tailNames = new Set(tailAuthors.value.map((a) => a.name));
  if (tailAuthors.value.length > 0) {
    const otherData = months.map((m) => Object.entries(m.byAuthor)
      .reduce((s, [n, v]) => s + (tailNames.has(n) ? v : 0), 0));
    if (otherData.some((v) => v > 0)) result.push({ name: t('stats.other'), data: otherData });
  }
  return result;
});

const monthlyColors = computed(() => {
  if (monthlyAuthors.value.length > 0) return monthlyAuthors.value.map(colorForAuthor);
  if (monthlyMetric.value === 'commits') return [tc.value.accent];
  const colors = topAuthors.value.map((a) => colorForAuthor(a.name));
  if (tailAuthors.value.length > 0) colors.push(tc.value.textMuted);
  return colors;
});

const monthlyOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'bar', stacked: true },
  colors: monthlyColors.value,
  plotOptions: { bar: { columnWidth: '62%', borderRadius: 2 } },
  dataLabels: { enabled: false },
  stroke: { width: 0 },
  xaxis: { categories: monthCategories.value, axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { rotate: -45, rotateAlways: false, hideOverlappingLabels: true, style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  legend: { position: 'top', horizontalAlign: 'left', fontSize: '11px', labels: { colors: tc.value.text } },
  tooltip: { theme: tooltipTheme.value },
  fill: { opacity: 1 },
}));

// ---- Area: commit activity over time --------------------------------------

const activityRange = ref(0);
const activityAuthors = ref<string[]>([]);
const activityMonths = computed(() => monthsInRange(activityRange.value));

const activityChart = ref<any>(null);
function resetActivityZoom() {
  // resetSeries(shouldUpdateChart, shouldResetZoom) — the second arg clears the zoom window.
  activityChart.value?.resetSeries?.(true, true);
}

const activitySeries = computed(() => {
  const months = activityMonths.value;
  if (activityAuthors.value.length > 0) {
    return activityAuthors.value.map((name) => ({ name, data: months.map((m) => commitsIn(m, name)) }));
  }
  return [{ name: t('stats.commits'), data: months.map((m) => m.commits) }];
});

const activityOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'area', sparkline: { enabled: false }, zoom: { enabled: true, type: 'x', autoScaleYaxis: true } },
  colors: activityAuthors.value.length > 0 ? activityAuthors.value.map(colorForAuthor) : [tc.value.accent],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
  xaxis: { categories: activityMonths.value.map((m) => m.month), axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { rotate: -45, hideOverlappingLabels: true, style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  legend: { show: activityAuthors.value.length > 0, position: 'top', horizontalAlign: 'left', fontSize: '11px', labels: { colors: tc.value.text } },
  tooltip: { theme: tooltipTheme.value },
}));

// ---- Bar: commits by weekday ----------------------------------------------

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const weekdayAuthors = ref<string[]>([]);

const weekdaySeries = computed(() => {
  const picked = weekdayAuthors.value;
  if (picked.length > 0) {
    const by = stats.value?.weekdayByAuthor ?? {};
    return picked.map((name) => ({ name, data: by[name] ?? new Array(7).fill(0) }));
  }
  return [{ name: t('stats.commits'), data: stats.value?.weekday ?? [] }];
});

const weekdayOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'bar', stacked: weekdayAuthors.value.length > 1 },
  colors: weekdayAuthors.value.length > 0 ? weekdayAuthors.value.map(colorForAuthor) : [tc.value.accent],
  plotOptions: { bar: { columnWidth: '55%', borderRadius: 3, distributed: false } },
  dataLabels: { enabled: false },
  xaxis: { categories: WEEKDAYS.map((d) => t(`stats.weekday.${d}`)), axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  legend: { show: weekdayAuthors.value.length > 0, position: 'top', horizontalAlign: 'left', fontSize: '11px', labels: { colors: tc.value.text } },
  tooltip: { theme: tooltipTheme.value },
}));

// ---- Bar: activity by hour ------------------------------------------------

const hourlyAuthors = ref<string[]>([]);

const hourlySeries = computed(() => {
  const picked = hourlyAuthors.value;
  if (picked.length > 0) {
    const by = stats.value?.hourlyByAuthor ?? {};
    return picked.map((name) => ({ name, data: by[name] ?? new Array(24).fill(0) }));
  }
  return [{ name: t('stats.commits'), data: stats.value?.hourly ?? [] }];
});

const hourlyOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'bar', stacked: hourlyAuthors.value.length > 1 },
  colors: hourlyAuthors.value.length > 0 ? hourlyAuthors.value.map(colorForAuthor) : ['#a855f7'],
  plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
  dataLabels: { enabled: false },
  xaxis: { categories: Array.from({ length: 24 }, (_, i) => String(i)), axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { style: { fontSize: '9px' }, hideOverlappingLabels: false } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  legend: { show: hourlyAuthors.value.length > 0, position: 'top', horizontalAlign: 'left', fontSize: '11px', labels: { colors: tc.value.text } },
  tooltip: { theme: tooltipTheme.value },
}));

// A fresh dataset can drop contributors that were pinned in a filter; clearing
// avoids charts silently rendering empty series for people who are now absent.
watch(stats, () => {
  const known = new Set(authorRank.value.keys());
  const prune = (r: typeof monthlyAuthors) => { r.value = r.value.filter(n => known.has(n)); };
  prune(monthlyAuthors);
  prune(activityAuthors);
  prune(weekdayAuthors);
  prune(hourlyAuthors);
});

const depthLabel = (d: number) => (d === 0 ? t('stats.all_history') : t('stats.n_months', { n: d }));
</script>

<template>
  <div ref="rootEl" class="flex-1 min-h-0 flex flex-col bg-app">
    <!-- Header -->
    <div class="shrink-0 h-11 px-4 flex items-center justify-between border-b border-line bg-surface">
      <div class="flex items-center gap-2 text-content">
        <Icon icon="lucide:chart-pie" class="w-4 h-4 text-accent" />
        <span class="text-sm font-semibold">{{ t('stats.title') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-[11px] text-content-muted">{{ t('stats.depth') }}</label>
        <select
          v-model.number="depth"
          class="text-[11px] h-7 rounded border border-line-strong bg-app text-content px-2 focus:outline-none focus:border-accent"
        >
          <option v-for="d in DEPTH_OPTIONS" :key="d" :value="d">{{ depthLabel(d) }}</option>
        </select>
        <button
          @click="recompute"
          :disabled="loading || !repoPath"
          class="h-7 px-3 rounded bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-fg text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Icon :icon="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="['w-3.5 h-3.5', loading && 'animate-spin']" />
          {{ t('stats.compute') }}
        </button>
      </div>
    </div>

    <ScrollArea class="flex-1 min-h-0">
      <!-- Loading -->
      <div v-if="loading && !stats" class="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 text-content-muted">
        <Icon icon="lucide:loader-2" class="w-8 h-8 animate-spin text-accent" />
        <span class="text-xs">{{ t('stats.computing') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="errorMsg" class="h-full min-h-[300px] flex flex-col items-center justify-center gap-2 text-removed px-6 text-center">
        <Icon icon="lucide:triangle-alert" class="w-8 h-8" />
        <span class="text-xs max-w-md">{{ errorMsg }}</span>
      </div>

      <!-- Empty -->
      <div v-else-if="!hasData" class="h-full min-h-[300px] flex flex-col items-center justify-center gap-2 text-content-muted px-6 text-center">
        <Icon icon="lucide:chart-no-axes-combined" class="w-8 h-8 opacity-50" />
        <span class="text-xs">{{ repoPath ? t('stats.empty') : t('stats.no_repo') }}</span>
      </div>

      <div v-else class="p-4 flex flex-col gap-4">
        <!-- Overview cards -->
        <div class="grid gap-3" :style="{ gridTemplateColumns: gridCols(cardCols) }">
          <div
            v-for="card in overviewCards"
            :key="card.key"
            class="rounded-lg border border-line bg-surface px-3 py-2.5 flex flex-col gap-1"
          >
            <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-content-muted">
              <Icon :icon="card.icon" :class="['w-3.5 h-3.5', card.color]" />
              {{ card.label }}
            </div>
            <div class="text-lg font-bold tabular-nums text-content-strong truncate">{{ card.value }}</div>
          </div>
        </div>

        <!-- Pie + Summary table -->
        <div class="grid gap-4" :style="{ gridTemplateColumns: pieSummaryTwoCol ? '1fr 1fr' : '1fr' }">
          <ChartPanel :title="t('stats.contribution_share')">
            <template #filters>
              <SegmentedToggle v-model="shareMetric" :options="METRIC_OPTIONS" />
              <SegmentedToggle v-model="shareTop" :options="TOP_OPTIONS" />
            </template>
            <VueApexChart type="donut" height="280" :options="pieOptions" :series="pieSeries" />
          </ChartPanel>

          <ChartPanel :title="t('stats.summary')">
            <template #filters>
              <div class="h-stat-control px-2 rounded border border-line flex items-center gap-1.5 min-w-0 w-[150px] shrink-0">
                <Icon icon="lucide:search" class="w-3 h-3 text-content-muted shrink-0" />
                <input
                  v-model="summaryQuery"
                  :placeholder="t('stats.search_developer')"
                  class="flex-1 min-w-0 bg-transparent text-[10px] text-content outline-none placeholder:text-content-muted"
                />
                <button
                  v-if="summaryQuery"
                  @click="summaryQuery = ''"
                  class="shrink-0 text-content-muted hover:text-content-strong"
                >
                  <Icon icon="lucide:x" class="w-3 h-3" />
                </button>
              </div>
              <SegmentedToggle v-model="summarySort" :options="SUMMARY_SORT_OPTIONS" />
              <Tooltip :text="t(summaryDesc ? 'stats.sort_desc' : 'stats.sort_asc')" position="top">
                <button
                  @click="summaryDesc = !summaryDesc"
                  class="w-stat-control h-stat-control flex items-center justify-center rounded border border-line text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors shrink-0"
                >
                  <Icon :icon="summaryDesc ? 'lucide:arrow-down-narrow-wide' : 'lucide:arrow-up-narrow-wide'" class="w-3 h-3" />
                </button>
              </Tooltip>
            </template>

            <!-- Fixed header + virtualized body (handles thousands of contributors) -->
            <div class="grid text-[11px] text-content-muted border-b border-line pb-1.5 px-2" :style="{ gridTemplateColumns: SUMMARY_COLS }">
              <span class="font-medium">{{ t('stats.developer') }}</span>
              <span class="font-medium text-right">{{ t('stats.commits') }}</span>
              <span class="font-medium text-right">{{ t('stats.lines') }}</span>
              <span class="font-medium text-right">{{ t('stats.avg') }}</span>
            </div>
            <div v-bind="summaryContainerProps" class="h-[280px] mt-0.5 gb-scroll">
              <div v-bind="summaryWrapperProps">
                <div
                  v-for="{ data: a, index: i } in virtualAuthors"
                  :key="a.email + a.name + i"
                  class="grid items-center border-b border-line px-2 text-[11px] hover:bg-surface-hover"
                  :style="{ height: SUMMARY_ROW_H + 'px', gridTemplateColumns: SUMMARY_COLS }"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2 h-2 rounded-sm shrink-0" :style="{ background: colorForAuthor(a.name) }" />
                    <img :src="gravatarUrl(a.email)" loading="lazy" class="w-4 h-4 rounded-sm border border-line shrink-0" />
                    <Tooltip :text="a.email" position="top" class="min-w-0">
                      <span class="truncate text-content">{{ a.name }}</span>
                    </Tooltip>
                  </div>
                  <span class="text-right tabular-nums text-content">{{ fmt(a.commits) }}</span>
                  <span class="text-right tabular-nums text-content">{{ fmt(a.lines) }}</span>
                  <span class="text-right tabular-nums text-content-muted">{{ fmt(a.avgLinesPerCommit) }}</span>
                </div>
              </div>
            </div>
            <div v-if="summaryAuthors.length === 0" class="text-[10px] text-content-muted text-center py-2">
              {{ t('stats.no_match') }}
            </div>
          </ChartPanel>
        </div>

        <!-- Monthly contributions -->
        <ChartPanel :title="t('stats.monthly_contributions')">
          <template #filters>
            <SegmentedToggle v-model="monthlyMetric" :options="METRIC_OPTIONS" />
            <SegmentedToggle v-model="monthlyRange" :options="RANGE_OPTIONS" />
            <AuthorFilter v-model="monthlyAuthors" :options="authorOptions" />
          </template>
          <VueApexChart type="bar" height="300" :options="monthlyOptions" :series="monthlySeries" />
        </ChartPanel>

        <!-- Activity + weekday -->
        <div class="grid gap-4" :style="{ gridTemplateColumns: dualChartTwoCol ? '1fr 1fr' : '1fr' }">
          <ChartPanel :title="t('stats.commit_activity')">
            <template #filters>
              <SegmentedToggle v-model="activityRange" :options="RANGE_OPTIONS" />
              <AuthorFilter v-model="activityAuthors" :options="authorOptions" />
              <Tooltip :text="t('stats.reset_zoom')" position="top">
                <button
                  @click="resetActivityZoom"
                  class="w-stat-control h-stat-control flex items-center justify-center rounded border border-line text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors"
                >
                  <Icon icon="lucide:zoom-out" class="w-3 h-3" />
                </button>
              </Tooltip>
            </template>
            <VueApexChart ref="activityChart" type="area" height="240" :options="activityOptions" :series="activitySeries" />
          </ChartPanel>

          <ChartPanel :title="t('stats.by_weekday')">
            <template #filters>
              <AuthorFilter v-model="weekdayAuthors" :options="authorOptions" />
            </template>
            <VueApexChart type="bar" height="240" :options="weekdayOptions" :series="weekdaySeries" />
          </ChartPanel>
        </div>

        <!-- Hourly -->
        <ChartPanel :title="t('stats.by_hour')">
          <template #filters>
            <AuthorFilter v-model="hourlyAuthors" :options="authorOptions" />
          </template>
          <VueApexChart type="bar" height="200" :options="hourlyOptions" :series="hourlySeries" />
        </ChartPanel>
      </div>
    </ScrollArea>
  </div>
</template>

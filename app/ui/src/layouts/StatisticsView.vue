<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useElementSize, useDebounceFn, useVirtualList } from '@vueuse/core';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import VueApexChart from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { repoPath, activeTab } from '../services/gitService';
import { useTheme, activeTheme } from '../services/themeService';
import { gravatarUrl } from '../utils/avatars';
import type { GitStatistics } from '../types/git';
import ScrollArea from '../components/Common/ScrollArea.vue';
import Tooltip from '../components/Common/Tooltip.vue';

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
const metric = ref<'lines' | 'commits'>('lines'); // for the monthly stacked bar

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

// Top authors drive the pie + the stacked bar; the long tail is bucketed.
const TOP_N = 6;
const topAuthors = computed(() => authors.value.slice(0, TOP_N));
const tailAuthors = computed(() => authors.value.slice(TOP_N));

// The summary can hold thousands of contributors, so it's virtualized: only the
// visible rows render (and only their avatars are requested). Charts are safe —
// they bucket everyone beyond the top few into a single "Other" slice/series.
const SUMMARY_COLS = '1fr 56px 76px 64px';
const SUMMARY_ROW_H = 34;
const {
  list: virtualAuthors,
  containerProps: summaryContainerProps,
  wrapperProps: summaryWrapperProps,
} = useVirtualList(authors, { itemHeight: SUMMARY_ROW_H, overscan: 8 });

function humanBytes(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
const fmt = (n: number) => (n ?? 0).toLocaleString();

const overviewCards = computed(() => {
  const s = stats.value;
  if (!s) return [];
  return [
    { key: 'commits', icon: 'lucide:git-commit-horizontal', label: t('stats.commits'), value: fmt(s.totalCommits), color: 'text-blue-400' },
    { key: 'contributors', icon: 'lucide:users', label: t('stats.contributors'), value: fmt(authors.value.length), color: 'text-emerald-400' },
    { key: 'branches', icon: 'lucide:git-branch', label: t('stats.branches'), value: fmt(s.branchCount), color: 'text-purple-400' },
    { key: 'tags', icon: 'lucide:tag', label: t('stats.tags'), value: fmt(s.tagCount), color: 'text-amber-400' },
    { key: 'size', icon: 'lucide:database', label: t('stats.size'), value: humanBytes(s.sizeBytes), color: 'text-cyan-400' },
    { key: 'churn', icon: 'lucide:diff', label: t('stats.churn'), value: `+${fmt(s.totalAdded)} / -${fmt(s.totalDeleted)}`, color: 'text-neutral-400' },
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

// ---- Pie: contribution share ----------------------------------------------

const pieSeries = computed(() => {
  const top = topAuthors.value.map((a) => a.lines);
  const tail = tailAuthors.value.reduce((s, a) => s + a.lines, 0);
  return tail > 0 ? [...top, tail] : top;
});
const pieOptions = computed<ApexOptions>(() => {
  const labels = topAuthors.value.map((a) => a.name);
  if (tailAuthors.value.length > 0) labels.push(t('stats.other'));
  const colors = topAuthors.value.map((_, i) => colorForIndex(i));
  if (tailAuthors.value.length > 0) colors.push(tc.value.textMuted);
  const total = pieSeries.value.reduce((s, v) => s + v, 0) || 1;
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
    tooltip: { theme: tooltipTheme.value, y: { formatter: (v: number) => `${fmt(v)} ${t('stats.lines_lc')}` } },
    plotOptions: { pie: { donut: { size: '62%', labels: { show: false } } } },
    states: { hover: { filter: { type: 'lighten', value: 0.08 } } },
  };
});

// ---- Stacked bar: monthly contributions -----------------------------------

const monthCategories = computed(() => (stats.value?.monthly ?? []).map((m) => m.month));

const monthlySeries = computed(() => {
  const months = stats.value?.monthly ?? [];
  // Commits metric: a single series of monthly commit counts.
  if (metric.value === 'commits') {
    return [{ name: t('stats.commits'), data: months.map((m) => m.commits) }];
  }
  // Lines metric: one stacked series per top author + a bucketed "Other".
  const result = topAuthors.value.map((a) => ({
    name: a.name,
    data: months.map((m) => (m.byAuthor[a.name] || 0)),
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
  if (metric.value === 'commits') return [tc.value.accent];
  const colors = topAuthors.value.map((_, i) => colorForIndex(i));
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

const activityChart = ref<any>(null);
function resetActivityZoom() {
  // resetSeries(shouldUpdateChart, shouldResetZoom) — the second arg clears the zoom window.
  activityChart.value?.resetSeries?.(true, true);
}

const activityOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'area', sparkline: { enabled: false }, zoom: { enabled: true, type: 'x', autoScaleYaxis: true } },
  colors: [tc.value.accent],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
  xaxis: { categories: monthCategories.value, axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { rotate: -45, hideOverlappingLabels: true, style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  tooltip: { theme: tooltipTheme.value },
}));
const activitySeries = computed(() => [{ name: t('stats.commits'), data: (stats.value?.monthly ?? []).map((m) => m.commits) }]);

// ---- Bar: commits by weekday ----------------------------------------------

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const weekdayOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'bar' },
  colors: [tc.value.accent],
  plotOptions: { bar: { columnWidth: '55%', borderRadius: 3, distributed: false } },
  dataLabels: { enabled: false },
  xaxis: { categories: WEEKDAYS.map((d) => t(`stats.weekday.${d}`)), axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { style: { fontSize: '10px' } } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  tooltip: { theme: tooltipTheme.value },
}));
const weekdaySeries = computed(() => [{ name: t('stats.commits'), data: stats.value?.weekday ?? [] }]);

// ---- Bar: activity by hour ------------------------------------------------

const hourlyOptions = computed<ApexOptions>(() => ({
  chart: { ...baseChart.value, type: 'bar' },
  colors: ['#a855f7'],
  plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
  dataLabels: { enabled: false },
  xaxis: { categories: Array.from({ length: 24 }, (_, i) => String(i)), axisBorder: { color: gridColor.value }, axisTicks: { color: gridColor.value }, labels: { style: { fontSize: '9px' }, hideOverlappingLabels: false } },
  yaxis: { labels: { formatter: (v: number) => fmt(Math.round(v)) } },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  tooltip: { theme: tooltipTheme.value },
}));
const hourlySeries = computed(() => [{ name: t('stats.commits'), data: stats.value?.hourly ?? [] }]);

const depthLabel = (d: number) => (d === 0 ? t('stats.all_history') : t('stats.n_months', { n: d }));
</script>

<template>
  <div ref="rootEl" class="flex-1 min-h-0 flex flex-col bg-app">
    <!-- Header -->
    <div class="shrink-0 h-11 px-4 flex items-center justify-between border-b border-line bg-surface">
      <div class="flex items-center gap-2 text-content">
        <Icon icon="lucide:chart-pie" class="w-4 h-4 text-blue-400" />
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
          class="h-7 px-3 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Icon :icon="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="['w-3.5 h-3.5', loading && 'animate-spin']" />
          {{ t('stats.compute') }}
        </button>
      </div>
    </div>

    <ScrollArea class="flex-1 min-h-0">
      <!-- Loading -->
      <div v-if="loading && !stats" class="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 text-neutral-500">
        <Icon icon="lucide:loader-2" class="w-8 h-8 animate-spin text-blue-400" />
        <span class="text-xs">{{ t('stats.computing') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="errorMsg" class="h-full min-h-[300px] flex flex-col items-center justify-center gap-2 text-red-400 px-6 text-center">
        <Icon icon="lucide:triangle-alert" class="w-8 h-8" />
        <span class="text-xs max-w-md">{{ errorMsg }}</span>
      </div>

      <!-- Empty -->
      <div v-else-if="!hasData" class="h-full min-h-[300px] flex flex-col items-center justify-center gap-2 text-neutral-500 px-6 text-center">
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
            <div class="text-lg font-bold tabular-nums text-neutral-800 dark:text-neutral-100 truncate">{{ card.value }}</div>
          </div>
        </div>

        <!-- Pie + Summary table -->
        <div class="grid gap-4" :style="{ gridTemplateColumns: pieSummaryTwoCol ? '1fr 1fr' : '1fr' }">
          <div class="rounded-lg border border-line bg-surface p-3">
            <div class="text-[11px] font-semibold text-content mb-1">{{ t('stats.contribution_share') }}</div>
            <VueApexChart type="donut" height="280" :options="pieOptions" :series="pieSeries" />
          </div>

          <div class="rounded-lg border border-line bg-surface p-3 flex flex-col min-h-0">
            <div class="text-[11px] font-semibold text-content mb-2">{{ t('stats.summary') }}</div>
            <!-- Fixed header + virtualized body (handles thousands of contributors) -->
            <div class="grid text-[11px] text-content-muted border-b border-line pb-1.5 px-2" :style="{ gridTemplateColumns: SUMMARY_COLS }">
              <span class="font-medium">{{ t('stats.developer') }}</span>
              <span class="font-medium text-right">{{ t('stats.commits') }}</span>
              <span class="font-medium text-right">{{ t('stats.lines') }}</span>
              <span class="font-medium text-right">{{ t('stats.avg') }}</span>
            </div>
            <div v-bind="summaryContainerProps" class="h-[280px] mt-0.5">
              <div v-bind="summaryWrapperProps">
                <div
                  v-for="{ data: a, index: i } in virtualAuthors"
                  :key="a.email + a.name + i"
                  class="grid items-center border-b border-neutral-100 dark:border-neutral-800/50 px-2 text-[11px] hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  :style="{ height: SUMMARY_ROW_H + 'px', gridTemplateColumns: SUMMARY_COLS }"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2 h-2 rounded-sm shrink-0" :style="{ background: i < TOP_N ? colorForIndex(i) : tc.textMuted }" />
                    <img :src="gravatarUrl(a.email)" loading="lazy" class="w-4 h-4 rounded-sm border border-line shrink-0" />
                    <Tooltip :text="a.email" position="top" class="min-w-0">
                      <span class="truncate text-content">{{ a.name }}</span>
                    </Tooltip>
                  </div>
                  <span class="text-right tabular-nums text-content">{{ fmt(a.commits) }}</span>
                  <span class="text-right tabular-nums text-content">{{ fmt(a.lines) }}</span>
                  <span class="text-right tabular-nums text-neutral-500">{{ fmt(a.avgLinesPerCommit) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Monthly contributions -->
        <div class="rounded-lg border border-line bg-surface p-3">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[11px] font-semibold text-content">{{ t('stats.monthly_contributions') }}</div>
            <div class="flex items-center rounded border border-line overflow-hidden text-[10px]">
              <button
                @click="metric = 'lines'"
                :class="['px-2 py-1 transition-colors', metric === 'lines' ? 'bg-blue-600 text-white' : 'text-content-muted hover:bg-neutral-100 dark:hover:bg-neutral-800']"
              >{{ t('stats.lines') }}</button>
              <button
                @click="metric = 'commits'"
                :class="['px-2 py-1 transition-colors', metric === 'commits' ? 'bg-blue-600 text-white' : 'text-content-muted hover:bg-neutral-100 dark:hover:bg-neutral-800']"
              >{{ t('stats.commits') }}</button>
            </div>
          </div>
          <VueApexChart type="bar" height="300" :options="monthlyOptions" :series="monthlySeries" />
        </div>

        <!-- Activity + weekday -->
        <div class="grid gap-4" :style="{ gridTemplateColumns: dualChartTwoCol ? '1fr 1fr' : '1fr' }">
          <div class="rounded-lg border border-line bg-surface p-3">
            <div class="flex items-center justify-between mb-1">
              <div class="text-[11px] font-semibold text-content">{{ t('stats.commit_activity') }}</div>
              <Tooltip :text="t('stats.reset_zoom')" position="left">
                <button
                  @click="resetActivityZoom"
                  class="w-6 h-6 flex items-center justify-center rounded border border-line text-content-muted hover:text-neutral-800 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Icon icon="lucide:zoom-out" class="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
            <VueApexChart ref="activityChart" type="area" height="240" :options="activityOptions" :series="activitySeries" />
          </div>
          <div class="rounded-lg border border-line bg-surface p-3">
            <div class="text-[11px] font-semibold text-content mb-1">{{ t('stats.by_weekday') }}</div>
            <VueApexChart type="bar" height="240" :options="weekdayOptions" :series="weekdaySeries" />
          </div>
        </div>

        <!-- Hourly -->
        <div class="rounded-lg border border-line bg-surface p-3">
          <div class="text-[11px] font-semibold text-content mb-1">{{ t('stats.by_hour') }}</div>
          <VueApexChart type="bar" height="200" :options="hourlyOptions" :series="hourlySeries" />
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

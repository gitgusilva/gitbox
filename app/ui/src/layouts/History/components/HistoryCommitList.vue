<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import CommitGraph from '../../../components/CommitGraph.vue';
import { Commit, GraphNode } from '../../../types/git';
import { gravatarUrl } from '../../../utils/avatars';
import { formatDate, renderMessageLinks } from '../../../utils/formatters';
import { startMarquee, stopMarquee } from '../../../utils/dom';
import { historyAuthorWidth, historyDateWidth, layoutRefs } from '../../../services/layoutService';
import Resizer from '../../../components/Common/Resizer.vue';
import Tooltip from '../../../components/Common/Tooltip.vue';

const props = defineProps<{
  log: Commit[];
  graphOutput: Map<string, GraphNode>;
  selectedCommits: Commit[];
  commitRefsMap: Map<string, any[]>;
  isLoadingData: boolean;
  selectedLogRef: string;
  dateFormat: string;
  showTagsInGraph: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', commit: Commit, event: MouseEvent): void;
  (e: 'contextMenu', event: MouseEvent, commit: Commit): void;
  (e: 'clearRef'): void;
  (e: 'loadMore'): void;
}>();

const { t } = useI18n();

/** Native scroll container reference (avoids SimpleBar fragment root issues) */
const scrollContainer = ref<HTMLElement | null>(null);
const showScrollToTop = ref(false);
const scrollTop = ref(0);

const ROW_HEIGHT = 30;
const VISIBLE_CHUNKS = 80;

const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - 15));
const endIndex = computed(() => Math.min(props.log.length, startIndex.value + VISIBLE_CHUNKS));
const visibleLog = computed(() => props.log.slice(startIndex.value, endIndex.value));

// Selection lookup as a Set — each visible row checked selection ~7×, so an
// O(1) has() replaces hundreds of O(selected) array scans per render pass.
const selectedIdSet = computed(() => new Set(props.selectedCommits.map(c => c.id)));

function handleScroll(e: Event) {
  const target = e.target as HTMLElement;
  window.requestAnimationFrame(() => {
    scrollTop.value = target.scrollTop || 0;
    showScrollToTop.value = scrollTop.value > 500;
    // Near the bottom of what's loaded → request the next page.
    const remainingPx = target.scrollHeight - (target.scrollTop + target.clientHeight);
    if (remainingPx < ROW_HEIGHT * 25) emit('loadMore');
  });
}

function scrollToTop() {
  scrollContainer.value?.scrollTo({ top: 0, behavior: 'smooth' });
}

defineExpose({
  scrollToTop,
  scrollToCommit: (id: string) => {
    const el = document.getElementById('commit-' + id);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
});
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 border-r border-neutral-200 dark:border-neutral-800 min-w-0 bg-neutral-50 dark:bg-[#181818] relative">
    
    <!-- Column Header (h-[42px] to line up with the detail panel's title bar) -->
    <div class="grid items-center h-[42px] border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#252526] px-3 font-bold text-[10px] text-neutral-500 dark:text-neutral-400 select-none uppercase tracking-widest shrink-0"
         :style="{ gridTemplateColumns: `minmax(100px, 1fr) ${historyAuthorWidth}px ${historyDateWidth}px` }">
       <div class="py-2 flex items-center justify-center gap-2 min-w-0 overflow-hidden"
            @mouseenter="startMarquee($event, '.hdr-title')" @mouseleave="stopMarquee($event, '.hdr-title')">
         <span class="truncate hdr-title">{{ t('history.subject') }}</span>
         <span v-if="selectedLogRef" class="shrink-0 text-blue-400 font-mono text-[9px] bg-blue-900/30 px-1 rounded truncate normal-case tracking-normal border border-blue-500/30">
           {{ selectedLogRef }}
           <button @click.stop="emit('clearRef')" class="pl-1 hover:text-white">✕</button>
         </span>
       </div>
        <div class="py-2 relative pl-2 pr-4 overflow-hidden">
          <span class="block truncate">{{ t('history.author') }}</span>
          <Resizer :target="layoutRefs.historyAuthorWidth" :options="{ min: 60 }" class="absolute right-0 top-0 bottom-0 z-30" />
        </div>
        <div class="py-2 pl-2 pr-4 relative overflow-hidden">
          <span class="block truncate">{{ t('history.time') }}</span>
          <Resizer :target="layoutRefs.historyDateWidth" :options="{ min: 60 }" class="absolute right-0 top-0 bottom-0 z-30" />
        </div>
    </div>
    
    <!-- Native Scroll Container — required for virtual scroll offset calculation -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto overflow-x-hidden min-h-0 commit-list-scroll"
      @scroll="handleScroll"
    >
      <!-- Loading Skeleton — mirrors the real commit-row layout -->
      <div v-if="isLoadingData" class="sticky top-0 left-0 right-0 z-50 bg-neutral-50 dark:bg-[#181818]">
        <div v-for="i in 18" :key="'sk-' + i"
             class="grid px-3 items-center"
             :style="{ gridTemplateColumns: `minmax(100px, 1fr) ${historyAuthorWidth}px ${historyDateWidth}px`, height: `${ROW_HEIGHT}px` }">
          <!-- Subject: graph dot + message bar -->
          <div class="flex items-center gap-2 animate-pulse" :style="{ animationDelay: (i * 60) + 'ms' }">
            <div class="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700 shrink-0 ml-1.5"></div>
            <div class="h-2.5 rounded bg-neutral-200 dark:bg-neutral-800" :style="{ width: (35 + (i * 13) % 50) + '%' }"></div>
          </div>
          <!-- Author: avatar + name bar -->
          <div class="flex items-center gap-2 pl-2 animate-pulse" :style="{ animationDelay: (i * 60) + 'ms' }">
            <div class="w-[18px] h-[18px] rounded bg-neutral-300 dark:bg-neutral-700 shrink-0"></div>
            <div class="h-2.5 rounded bg-neutral-200 dark:bg-neutral-800" :style="{ width: (40 + (i * 17) % 40) + '%' }"></div>
          </div>
          <!-- Date bar -->
          <div class="pl-2 animate-pulse" :style="{ animationDelay: (i * 60) + 'ms' }">
            <div class="h-2.5 w-20 rounded bg-neutral-200 dark:bg-neutral-800"></div>
          </div>
        </div>
      </div>

      <!-- Virtual Scroll Spacer: total height = n * row height -->
      <div :style="{ height: `${log.length * ROW_HEIGHT}px`, position: 'relative' }">
        <!-- Visible window: positioned at computed Y offset -->
        <div :style="{ transform: `translateY(${startIndex * ROW_HEIGHT}px)`, position: 'absolute', top: 0, left: 0, right: 0 }">
          <div
            v-for="c in visibleLog"
            :key="c.id"
            :id="'commit-' + c.id"
            class="grid px-3 items-center text-[11px] relative group"
            :style="{ gridTemplateColumns: `minmax(100px, 1fr) ${historyAuthorWidth}px ${historyDateWidth}px`, height: `${ROW_HEIGHT}px` }"
            :class="selectedIdSet.has(c.id)
              ? 'bg-blue-100 dark:bg-[#143B66] text-black dark:text-white shadow-inner'
              : 'hover:bg-neutral-200 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'"
            @click="emit('select', c, $event)"
            @contextmenu.prevent="emit('contextMenu', $event, c)"
          >
            <!-- Subject column -->
            <div class="flex items-center w-full h-full overflow-hidden relative z-0">
              <!-- Hovering the graph shows the commit subject — handy when the graph
                   is wide and pushes the message text out of view. -->
              <Tooltip :text="c.summary" position="right" class="h-full flex-shrink-0">
                <CommitGraph :node="graphOutput.get(c.id)" :selected="selectedIdSet.has(c.id)" />
              </Tooltip>
              <div class="flex-1 min-w-0 pr-4 h-full flex items-center gap-1">
                <template v-for="r in (commitRefsMap.get(c.id) || [])" :key="r.name">
                  <div v-if="r.type !== 'tag' || showTagsInGraph"
                       class="flex-shrink-0 text-[10px] px-1 rounded-[3px] border flex items-center gap-[2px] h-[18px] z-10"
                       :class="r.type === 'tag'
                         ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-500 font-medium'
                         : (r.isHead ? 'font-bold' : 'font-medium')"
                       :style="r.type !== 'tag' ? {
                         color: graphOutput.get(c.id)?.color || '#888888',
                         borderColor: (graphOutput.get(c.id)?.color || '#888888') + (r.isHead ? 'cc' : '66'),
                         backgroundColor: (graphOutput.get(c.id)?.color || '#888888') + (r.isHead ? '33' : '14')
                       } : {}">
                    <Icon :icon="r.type === 'tag' ? 'lucide:tag' : (r.type === 'remote' ? 'lucide:cloud' : 'lucide:git-branch')" class="text-[9px]" />
                    {{ r.name.replace('refs/remotes/', '') }}
                  </div>
                </template>
                <div class="flex-1 min-w-0 h-full flex items-center overflow-hidden"
                     @mouseenter="startMarquee($event, '.truncate')"
                     @mouseleave="stopMarquee($event, '.truncate')">
                  <span
                    class="block truncate w-full"
                    :class="selectedIdSet.has(c.id) ? '' : (graphOutput.get(c.id)?.dotLane === 0 ? 'font-medium text-black dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-500')"
                    v-html="renderMessageLinks(c.summary)"
                  />
                </div>
              </div>
            </div>

            <!-- Author column -->
            <div class="flex items-center gap-2 min-w-0 pl-2 pr-1 h-full w-full relative z-0"
                 :class="selectedIdSet.has(c.id)
                   ? 'text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-[#143B66]'
                   : (graphOutput.get(c.id)?.dotLane === 0
                     ? 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-neutral-200'
                     : 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-400 dark:text-neutral-600')">
              <img :src="gravatarUrl(c.authorEmail || c.author + '@localhost')"
                   class="w-[18px] h-[18px] rounded border-2 border-neutral-200 dark:border-neutral-800 shadow-sm flex-shrink-0 object-cover" />
              <Tooltip :text="c.author" position="top" class="min-w-0 flex-1 overflow-hidden">
                <span class="block truncate">{{ c.author }}</span>
              </Tooltip>
            </div>

            <!-- Date column -->
            <div class="flex items-center min-w-0 pl-2 h-full w-full relative z-0"
                 :class="selectedIdSet.has(c.id)
                   ? 'text-blue-500/80 dark:text-blue-300/50 bg-blue-100 dark:bg-[#143B66]'
                   : (graphOutput.get(c.id)?.dotLane === 0
                     ? 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-500 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'
                     : 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-400/70 dark:text-neutral-600')">
              <Tooltip :text="formatDate(c.timestamp, dateFormat)" position="left" class="min-w-0 w-full overflow-hidden">
                <span class="block truncate">{{ formatDate(c.timestamp, dateFormat) }}</span>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll to Top button -->
    <Tooltip :text="t('history_detail.scroll_to_top')" position="top">
      <button
        v-show="showScrollToTop"
        @click="scrollToTop"
        class="absolute bottom-4 right-4 bg-white dark:bg-[#252526] border border-neutral-200 dark:border-neutral-700 shadow-lg text-neutral-600 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 p-2 rounded-full transition-all z-20 hover:scale-105 active:scale-95 outline-none flex items-center justify-center w-10 h-10"
      >
        <Icon icon="lucide:arrow-up-to-line" class="text-xl" />
      </button>
    </Tooltip>
  </div>
</template>

<style scoped>
/* Slim webkit scrollbar matching the app's dark theme */
.commit-list-scroll::-webkit-scrollbar {
  width: 6px;
}
.commit-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.commit-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
.commit-list-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { 
  filteredLogs, 
  activeCategory, 
  categories, 
  clearLogs 
} from '../services/logService';
import { useI18n } from 'vue-i18n';
import { formatDate } from '../utils/formatters';
import { startMarquee, stopMarquee } from '../utils/dom';
import { requestConfirm } from '../services/modalService';
import Tabs from '../components/Common/Tabs.vue';
import Tab from '../components/Common/Tab.vue';
import Tooltip from '../components/Common/Tooltip.vue';
import ScrollArea from '../components/Common/ScrollArea.vue';
import { onMounted, onUnmounted } from 'vue';

const { t } = useI18n();
const searchQuery = ref('');
const activeCategoryModel = computed({
  get: () => activeCategory.value,
  set: (value: typeof activeCategory.value) => {
    activeCategory.value = value;
  }
});

function handleClearLogs() {
  requestConfirm(
    t('common.confirm_clear_logs') || 'Clear Logs',
    t('common.confirm_clear_logs_msg') || 'Are you sure you want to clear all command logs?',
    true,
    clearLogs
  );
}

const searchFilteredLogs = computed(() => {
  if (!searchQuery.value) return filteredLogs.value;
  const q = searchQuery.value.toLowerCase();
  return filteredLogs.value.filter(log => 
    log.message.toLowerCase().includes(q) || 
    (log.command && log.command.toLowerCase().includes(q)) ||
    (log.details && log.details.toLowerCase().includes(q))
  );
});

// Lazy Loading / Infinite Scroll
const pageSize = 50;
const visibleCount = ref(pageSize);
const visibleLogs = computed(() => searchFilteredLogs.value.slice(0, visibleCount.value));

/** Holds the SimpleBar component instance */
const scrollAreaRef = ref<any>(null);

/** Gets the actual scrollable element from the SimpleBar instance */
function getScrollEl(): HTMLElement | null {
  if (!scrollAreaRef.value) return null;
  const sb = scrollAreaRef.value;
  if (typeof sb.getScrollElement === 'function') return sb.getScrollElement();
  if (sb.SimpleBar) return sb.SimpleBar.getScrollElement();
  return sb.$el?.querySelector?.('.simplebar-content-wrapper') ?? null;
}

function handleScroll() {
  const el = getScrollEl();
  if (!el) return;
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (visibleCount.value < searchFilteredLogs.value.length) {
      visibleCount.value += pageSize;
    }
  }
}

// Reset pagination when filters change
watch([activeCategory, searchQuery], () => {
    visibleCount.value = pageSize;
    const el = getScrollEl();
    if (el) el.scrollTop = 0;
});

onMounted(() => {
  // Attach scroll listener after SimpleBar mounts
  setTimeout(() => {
    const el = getScrollEl();
    if (el) el.addEventListener('scroll', handleScroll, { passive: true });
  }, 100);
});

onUnmounted(() => {
  const el = getScrollEl();
  if (el) el.removeEventListener('scroll', handleScroll);
});

const expandedIds = ref<Set<string>>(new Set());

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

function formatLogDate(timestamp: number) {
  // formatDate expects seconds
  return formatDate(timestamp / 1000);
}

const getIcon = (type: string, category: string) => {
    if (category === 'Git') return 'lucide:terminal';
    if (type === 'error') return 'lucide:alert-circle';
    if (type === 'success') return 'lucide:check-circle';

    return 'lucide:activity';
};

const getColor = (type: string) => {
    if (type === 'error') return 'text-red-400';
    if (type === 'success') return 'text-green-400';
    if (type === 'command') return 'text-blue-400';

    return 'text-content-muted';
};
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0 min-w-0 bg-app">
    <Tabs v-model="activeCategoryModel" type="underlined" @change="visibleCount = pageSize">
        <template #sidebar-footer>
            <div class="flex items-center gap-2 h-full">
                <div class="flex items-center gap-2">
                    <div class="relative w-48 sm:w-64">
                         <Icon icon="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
                         <input
                          v-model="searchQuery"
                          type="text"
                          :placeholder="t('common.search') || 'Search logs...'"
                          class="w-full bg-app border border-line rounded px-8 py-1 text-xs text-content-strong focus:outline-none focus:border-accent/50 transition-colors h-7"
                         />
                         <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-strong transition-colors">
                             <Icon icon="lucide:x" class="w-3.5 h-3.5" />
                         </button>
                    </div>
                </div>

                <Tooltip :text="t('common.clear')" position="left">
                  <button
                    @click="handleClearLogs"
                    class="flex items-center gap-1.5 px-3 h-7 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all active:scale-95"
                  >
                    <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
                    <span>{{ t('common.clear') || 'Clear' }}</span>
                  </button>
                </Tooltip>
            </div>
        </template>

        <template #default>
            <!-- Register all tabs (they don't render content here, just register themselves) -->
            <Tab v-for="cat in categories" :key="cat" :id="cat" :label="t('logs.categories.' + cat.toLowerCase())" />
            
            <div class="flex flex-col h-full bg-app">
                <!-- Panel Header -->
                <div class="grid px-4 font-bold text-[10px] text-content-muted uppercase tracking-widest border-b border-line bg-surface shrink-0" style="grid-template-columns: 1fr 120px;">
                    <div class="py-2">{{ t('common.message') || 'Message' }}</div>
                    <div class="py-2 pl-3 border-l border-line">{{ t('history.time') }}</div>
                </div>

                <!-- Shared List for all tabs -->
                <ScrollArea ref="scrollAreaRef" class="flex-1">
                    <div v-if="visibleLogs.length === 0" class="h-full flex flex-col items-center justify-center text-content-muted gap-3 opacity-50">
                        <Icon icon="lucide:list" class="w-12 h-12" />
                        <span class="text-sm font-medium">{{ t('common.no_logs') || 'No logs found' }}</span>
                    </div>

                    <div v-else class="min-h-full pb-4">
                        <div
                            v-for="log in visibleLogs"
                            :key="log.id"
                            class="border-b border-line hover:bg-surface-hover transition-colors"
                            :class="{ 'bg-surface': expandedIds.has(log.id) }"
                        >
                            <!-- Log Row -->
                            <div
                                @click="toggleExpand(log.id)"
                                class="grid px-4 py-2 cursor-pointer group items-center"
                                style="grid-template-columns: 1fr 120px;"
                            >
                                <div class="flex items-center gap-3 min-w-0 pr-2">
                                    <div class="flex-shrink-0" :class="getColor(log.type)">
                                        <Icon :icon="getIcon(log.type, log.category)" class="w-4 h-4" />
                                    </div>

                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 overflow-hidden h-5" @mouseenter="startMarquee($event, '.truncate')" @mouseleave="stopMarquee($event, '.truncate')">
                                            <div class="text-[11px] text-content font-medium truncate group-hover:text-content-strong transition-colors">
                                                {{ log.message }}
                                            </div>
                                        </div>
                                        <div v-if="log.command && !expandedIds.has(log.id)" 
                                            class="overflow-hidden h-4"
                                            @mouseenter="startMarquee($event, '.truncate')" @mouseleave="stopMarquee($event, '.truncate')">
                                            <div class="text-[10px] text-content-muted font-mono truncate opacity-60">
                                                {{ log.command }}
                                            </div>
                                        </div>
                                    </div>

                                    <div v-if="log.duration" class="flex-shrink-0 text-[10px] text-content-muted font-mono italic">
                                        {{ log.duration }}ms
                                    </div>
                                </div>

                                <div class="flex items-center justify-end pl-3 border-l border-line h-full tabular-nums">
                                    <div class="text-[10px] text-content-muted font-mono">
                                        {{ formatLogDate(log.timestamp) }}
                                    </div>
                                    <Icon
                                        icon="lucide:chevron-down"
                                        class="ml-2 w-3.5 h-3.5 text-content-muted transition-transform duration-200"
                                        :class="{ 'rotate-180': expandedIds.has(log.id) }"
                                    />
                                </div>
                            </div>

                            <!-- Details -->
                            <div v-if="expandedIds.has(log.id)" class="px-4 pb-4 pt-0">
                                <div class="ml-11 bg-app rounded border border-line p-3 overflow-hidden">
                                    <div v-if="log.command" class="mb-3">
                                        <div class="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <span>{{ t('logs.command') }}</span>
                                            <div class="h-px bg-line flex-1"></div>
                                        </div>
                                        <pre class="text-[11px] text-blue-300 font-mono whitespace-pre-wrap break-all leading-relaxed">{{ log.command }}</pre>
                                    </div>
                                    <div v-if="log.details">
                                        <div class="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                            <span>{{ t('logs.output') }}</span>
                                            <div class="h-px bg-line flex-1"></div>
                                        </div>
                                        <pre class="text-[11px] text-content-muted font-mono whitespace-pre-wrap break-all leading-relaxed">{{ log.details }}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </template>
    </Tabs>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>

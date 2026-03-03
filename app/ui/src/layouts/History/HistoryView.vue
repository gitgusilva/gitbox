<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { 
  log, 
  selectedCommit, 
  selectedLogRef, 
  loadRepoData,
  isLoadingData
} from '../../services/gitService';
import { 
  historyAuthorWidth, 
  historyDateWidth, 
  detailsWidth, 
  startResize, 
} from '../../services/layoutService';
import { buildCommitGraph } from '../../GraphBuilder';
import { GraphNode } from '../../types/git';
import CommitGraph from '../../components/CommitGraph.vue';
import { branches, tags } from '../../services/gitService';
import { formatFullDate, formatDate, renderMessageLinks, handleLinkClick } from '../../utils/formatters';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';
import { gravatarUrl } from '../../utils/avatars';
import { generalSettings } from '../../services/settingsService';

const { t } = useI18n();
const showTagsInGraph = computed(() => generalSettings.value.showTagsInGraph);
const graphOutput = shallowRef<Map<string, GraphNode>>(new Map());
const activeDetailTab = ref('information');
const commitFilesList = ref<any[]>([]);
const selectedCommitFile = ref('');
const commitOriginal = ref('');
const commitModified = ref('');
const fullRepoFilesList = ref<any[]>([]);
const selectedFilesTabPath = ref('');
const filesTabContent = ref('');
const isTreeLoading = ref(false);

import { repoPath } from '../../services/gitService';
import { contextMenu } from '../../services/modalService';
import FileTree from '../../components/Common/FileTree.vue';
import DiffViewer from '../../components/Common/DiffViewer.vue';

const loadCommitDetails = async () => {
    commitFilesList.value = [];
    selectedCommitFile.value = '';
    commitOriginal.value = '';
    commitModified.value = '';

    if (!selectedCommit.value || !repoPath.value) return;

    try {
        const files = await window.gitbox.commitFiles(repoPath.value, selectedCommit.value.id);
        commitFilesList.value = files;

        if (files.length > 0) {
            selectedCommitFile.value = files[0].path;
        }
    } catch(e) {}
};

watch(selectedCommit, () => {
    fullRepoFilesList.value = [];
    loadCommitDetails();
}, { immediate: true });

const loadFullRepoFiles = async () => {
    fullRepoFilesList.value = [];
    selectedFilesTabPath.value = '';
    filesTabContent.value = '';

    if (!selectedCommit.value || !repoPath.value) return;

    isTreeLoading.value = true;

    try {
        const filePaths = await window.gitbox.listFiles(repoPath.value, selectedCommit.value.id);
        fullRepoFilesList.value = filePaths.map((p: string) => ({ path: p, status: 'modified' }));
    } catch(e) {
        fullRepoFilesList.value = [];
    } finally {
        isTreeLoading.value = false;
    }
};

watch([selectedCommit, activeDetailTab], () => {
    if (activeDetailTab.value === 'files' && fullRepoFilesList.value.length === 0) {
        loadFullRepoFiles();
    }
});

watch(selectedFilesTabPath, async (newVal) => {
    if (!newVal || !selectedCommit.value || !repoPath.value) {
        filesTabContent.value = '';
        return;
    }

    try {
        // We can use diffCommitFile but only take the 'modified' side as the current content at that commit
        const diff = await window.gitbox.diffCommitFile(repoPath.value, selectedCommit.value.id, newVal);
        filesTabContent.value = diff.modified;
    } catch(e) {
        filesTabContent.value = '';
    }
});

watch(selectedCommitFile, async (newVal) => {
    if (!newVal || !selectedCommit.value || !repoPath.value) {
        commitOriginal.value = '';
        commitModified.value = '';
        return;
    }

    try {
        const diff = await window.gitbox.diffCommitFile(repoPath.value, selectedCommit.value.id, newVal);
        commitOriginal.value = diff.original;
        commitModified.value = diff.modified;
    } catch(e) {
        commitOriginal.value = '';
        commitModified.value = '';
    }
});

watch(log, (newLog, oldLog) => {
  if (newLog) {
      const headBranch = branches.value.find(b => b.is_head);
      graphOutput.value = buildCommitGraph(newLog, headBranch?.target || (newLog.length > 0 ? newLog[0].id : null));
  } else {
      graphOutput.value = new Map();
  }

  // Scroll back to top ONLY if log content meaningfully changed (e.g branch switch)
  if (!oldLog || newLog?.length !== oldLog.length || (newLog.length > 0 && oldLog.length > 0 && newLog[0].id !== oldLog[0].id)) {
      setTimeout(scrollToTop, 50);
  }
}, { immediate: true });


const commitRefsMap = computed(() => {
  const map = new Map<string, { name: string, type: 'branch' | 'tag' | 'remote', isHead?: boolean }[]>();
  branches.value.forEach(b => {
    if (b.target) {
      if (!map.has(b.target)) map.set(b.target, []);
      map.get(b.target)!.push({ name: b.name, type: b.is_remote ? 'remote' : 'branch', isHead: b.is_head });
    }
  });
  tags.value.forEach(t => {
    if (t.target) {
      if (!map.has(t.target)) map.set(t.target, []);
      map.get(t.target)!.push({ name: t.name, type: 'tag' });
    }
  });
  return map;
});

function startMarquee(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement;
  const textEl = container.querySelector('span.block.truncate') as HTMLElement;
  if (textEl && textEl.scrollWidth > textEl.clientWidth) {
    const distance = textEl.scrollWidth - textEl.clientWidth + 20;
    textEl.style.textOverflow = 'clip';
    textEl.style.overflow = 'visible'; // override truncate's hidden overflow so text renders beyond span width during transform
    textEl.style.transitionProperty = 'transform';
    textEl.style.transitionTimingFunction = 'linear';
    textEl.style.transitionDuration = `${Math.max(1000, distance * 20)}ms`;
    textEl.style.transform = `translateX(-${distance}px)`;
  }
}

function stopMarquee(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement;
  const textEl = container.querySelector('span.block.truncate') as HTMLElement;
  if (textEl) {
    textEl.style.transitionDuration = '200ms';
    textEl.style.transform = 'translateX(0)';
    setTimeout(() => {
        textEl.style.textOverflow = '';
        textEl.style.overflow = '';
    }, 200);
  }
}
function getStatusIcon(status: string) {
  if (!status) return 'lucide:file';
  const s = status.toLowerCase();
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'lucide:plus';
  if (s.includes('deleted')) return 'lucide:minus';
  if (s.includes('renamed') || s.includes('moved')) return 'lucide:repeat';
  if (s.includes('modified') || s.includes('staged')) return 'lucide:file-text';
  return 'lucide:file';
}

function getStatusColor(status: string) {
  if (!status) return 'text-neutral-500';
  const s = status.toLowerCase();
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'text-green-500';
  if (s.includes('deleted')) return 'text-red-500';
  if (s.includes('renamed') || s.includes('moved')) return 'text-purple-400';
  if (s.includes('modified') || s.includes('staged')) return 'text-[#E2B93D]';
  return 'text-neutral-500';
}
const commitListContainer = ref<any>(null);
const showScrollToTop = ref(false);

const ROW_HEIGHT = 30;
const scrollTop = ref(0);

// Optimize resize operations and scrolling by predicting maximum visible rows (up to 4K resolution)
const VISIBLE_CHUNKS = 80;

const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - 15));
const endIndex = computed(() => Math.min(log.value.length, startIndex.value + VISIBLE_CHUNKS));

const visibleLog = computed(() => log.value.slice(startIndex.value, endIndex.value));

let scrollListenerTarget: HTMLElement | null = null;

onMounted(() => {
  if (commitListContainer.value) {
    const el = commitListContainer.value.scrollElement || 
               (commitListContainer.value.$el && commitListContainer.value.$el.querySelector('.simplebar-content-wrapper')) || 
               commitListContainer.value.$el;
               
    if (el && el.addEventListener) {
      scrollListenerTarget = el;
      el.addEventListener('scroll', handleScroll, { passive: true });
    }
  }
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  if (scrollListenerTarget) {
    scrollListenerTarget.removeEventListener('scroll', handleScroll);
    scrollListenerTarget = null;
  }
  window.removeEventListener('keydown', onKeyDown);
});

function onKeyDown(e: KeyboardEvent) {
  // Check if we're focused on an input element first
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    return;
  }
  
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!selectedCommit.value || log.value.length === 0) return;
      
      const idx = log.value.findIndex(c => c.id === selectedCommit.value!.id);
      if (idx === -1) return;
      
      e.preventDefault();
      
      let nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < log.value.length) {
          selectedCommit.value = log.value[nextIdx];
          
          setTimeout(() => {
              const el = document.getElementById('commit-' + selectedCommit.value!.id);
              if (el) {
                  el.scrollIntoView({ block: 'nearest' });
              }
          }, 0);
      }
  }
}

function handleScroll(e: Event) {
  if (!e.target) return;
  const target = e.target as HTMLElement;
  // Use requestAnimationFrame to debounce scroll updates for smoother performance
  window.requestAnimationFrame(() => {
    scrollTop.value = target.scrollTop || 0;
    showScrollToTop.value = scrollTop.value > 500;
  });
}

function scrollToTop() {
  if (commitListContainer.value) {
    const el = commitListContainer.value.scrollElement || 
               (commitListContainer.value.$el && commitListContainer.value.$el.querySelector('.simplebar-content-wrapper')) || 
               commitListContainer.value.$el || 
               commitListContainer.value;
    if (el.scrollTo) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

function openContextMenu(e: MouseEvent, c: any) {
  selectedCommit.value = c;
  
  const items: any[] = [];
  
  // Determine if it has branches
  const refs = commitRefsMap.value.get(c.id) || [];
  const localBranches = refs.filter(r => r.type === 'branch');
  
  for (const b of localBranches) {
    items.push({
      label: b.name,
      icon: 'lucide:git-branch',
      subItems: [
        { label: 'Visibility in Graph', icon: 'lucide:eye' },
        { type: 'separator' },
        { label: `Fast-Forward to origin/${b.name}`, icon: 'lucide:fast-forward' },
        { label: `Pull origin/${b.name}`, icon: 'lucide:download' },
        { label: `Push ${b.name}`, icon: 'lucide:upload' },
        { label: `Rename ${b.name}...`, icon: 'lucide:text-cursor-input' },
        { type: 'separator' },
        { label: `Git Flow - Finish ${b.name}`, icon: 'lucide:git-merge' },
        { type: 'separator' },
        { label: 'Copy Branch Name', icon: 'lucide:copy', action: () => navigator.clipboard.writeText(b.name) }
      ]
    });
  }
  
  if (localBranches.length > 0) {
    items.push({ type: 'separator' });
  }

  items.push(
    { label: 'Create Branch...', icon: 'lucide:git-branch', shortcut: 'Ctrl+Shift+B', action: () => {} },
    { label: 'Create Tag...', icon: 'lucide:tag', shortcut: 'Ctrl+Shift+T', action: () => {} },
    { type: 'separator' },
    { label: 'Reword', icon: 'lucide:edit-3', action: () => {} },
    { label: 'Squash into Parent', icon: 'lucide:minimize-2', action: () => {} },
    { label: 'Revert Commit', icon: 'lucide:undo-2', action: () => {} },
    { type: 'separator' },
    { label: 'Save as Patch...', icon: 'lucide:file-text', action: () => {} },
    { label: 'Archive...', icon: 'lucide:archive', action: () => {} },
    { type: 'separator' },
    { label: 'Copy', icon: 'lucide:copy', subItems: [
        { label: 'Copy Commit Message', action: () => { if (c.summary) navigator.clipboard.writeText(c.summary); } },
        { label: 'Copy Commit SHA', action: () => { if (c.id) navigator.clipboard.writeText(c.id); } },
    ]}
  );

  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items
  };
}

const navigateToCommit = async (p: any) => {
    if (!p || !p.id) return;
    
    // 1. Try to find the full commit object in the currently loaded log
    const found = log.value.find(c => c.id === p.id);
    if (found) {
        selectedCommit.value = found;
        // Scroll the commit into view
        setTimeout(() => {
            const el = document.getElementById('commit-' + p.id);
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }, 50);
        return;
    }

    // 2. If not found in current log (e.g. beyond maxCount), try to fetch its full details
    try {
        const singleLog = await window.gitbox.log(repoPath.value, 1, p.id);
        if (singleLog && singleLog.length > 0) {
            selectedCommit.value = singleLog[0];
            return;
        }
    } catch (e) {
        console.error('Failed to fetch commit details:', e);
    }

    // 3. Last resort fallback: use the parent object stub which has basic info
    selectedCommit.value = p;
};
</script>

<template>
  <div class="flex-1 flex min-h-0 bg-white dark:bg-[#1E1E1E]">
    <!-- Commit List -->
    <div class="flex-1 flex flex-col min-h-0 border-r border-neutral-200 dark:border-neutral-800 min-w-0 bg-neutral-50 dark:bg-[#181818] relative">
      <div class="grid border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#252526] px-3 font-bold text-[10px] text-neutral-500 dark:text-neutral-400 select-none uppercase tracking-widest" 
           :style="{ gridTemplateColumns: `minmax(100px, 1fr) ${historyAuthorWidth}px ${historyDateWidth}px` }">
         <div class="py-2 flex items-center justify-center gap-2">
           <span>{{ t('history.subject') }}</span>
           <span v-if="selectedLogRef" class="text-blue-400 font-mono text-[9px] bg-blue-900/30 px-1 rounded truncate normal-case tracking-normal border border-blue-500/30">
             {{ selectedLogRef }} 
             <button @click.stop="selectedLogRef = ''; loadRepoData()" class="pl-1 hover:text-white">✕</button>
           </span>
         </div>
         <div class="py-2 relative border-l border-neutral-800/30 pl-2">
           <span>{{ t('history.author') }}</span>
           <div class="h-full w-1 absolute right-0 top-0 cursor-col-resize z-10" @mousedown="startResize('historyAuthor', $event)"></div>
         </div>
         <div class="py-2 pl-2 relative border-l border-neutral-800/30">
           <span>{{ t('history.time') }}</span>
           <div class="h-full w-1 absolute right-0 top-0 cursor-col-resize z-10" @mousedown="startResize('historyDate', $event)"></div>
         </div>
      </div>
      
      <SimpleBar class="flex-1 relative" style="height: 100%; min-height: 0; overflow-x: hidden;" ref="commitListContainer">
        <!-- Spinner Overlay -->
        <div v-if="isLoadingData" class="absolute inset-0 z-50 bg-white/20 dark:bg-black/20 backdrop-blur-[1px] flex items-center justify-center transition-opacity duration-300">
          <div class="flex flex-col items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#252526] shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in duration-300">
            <Icon icon="lucide:loader-2" class="text-3xl text-blue-500 animate-spin" />
            <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{{ t('common.loading') }}...</span>
          </div>
        </div>

        <div :style="{ height: `${log.length * ROW_HEIGHT}px`, position: 'relative' }">
          <div :style="{ transform: `translateY(${startIndex * ROW_HEIGHT}px)`, position: 'absolute', top: 0, left: 0, right: 0 }">
            <div v-for="c in visibleLog" :key="c.id" :id="'commit-' + c.id"
                 class="grid px-3 items-center text-[11px] relative group border-b border-neutral-200 dark:border-neutral-800/30" 
                 :style="{ gridTemplateColumns: `minmax(100px, 1fr) ${historyAuthorWidth}px ${historyDateWidth}px`, height: `${ROW_HEIGHT}px` }" 
                 :class="selectedCommit?.id === c.id ? 'bg-blue-100 dark:bg-[#143B66] text-black dark:text-white shadow-inner' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'" 
                 @click="selectedCommit = c"
                 @contextmenu.prevent="openContextMenu($event, c)">
              <div class="flex items-center gap-0 w-full h-full relative overflow-hidden">
                <CommitGraph :node="graphOutput.get(c.id)" :selected="selectedCommit?.id === c.id" />
                <div class="flex-1 min-w-0 pr-4 relative cursor-default h-full flex items-center gap-1">
                   <template v-for="r in (commitRefsMap.get(c.id) || [])" :key="r.name">
                     <div v-if="r.type !== 'tag' || showTagsInGraph"
                          class="flex-shrink-0 text-[10px] px-1 rounded-[3px] border flex items-center gap-[2px] h-[18px] z-10 bg-neutral-50 dark:bg-[#202020]"
                          :class="r.type === 'branch' ? (r.isHead ? 'bg-green-600/20 border-green-500/50 text-green-700 dark:text-green-400 font-bold' : 'bg-transparent border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 font-medium') : (r.type === 'remote' ? 'bg-transparent border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 font-medium' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-500 font-medium')">
                          <Icon :icon="r.type === 'tag' ? 'lucide:tag' : (r.type === 'remote' ? 'lucide:cloud' : 'lucide:git-branch')" class="text-[9px]" />
                          {{ r.name.replace('refs/remotes/', '') }}
                     </div>
                   </template>
                   <div class="flex-1 min-w-0 h-full flex items-center overflow-hidden" @mouseenter="startMarquee" @mouseleave="stopMarquee">
                       <span class="block truncate w-full" :class="selectedCommit?.id === c.id ? '' : (graphOutput.get(c.id)?.dotLane === 0 ? 'font-medium text-black dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-500')" v-html="renderMessageLinks(c.summary)"></span>
                   </div>
                </div>
              </div>
              <div class="flex items-center gap-2 truncate transition-colors pl-2 pr-1 h-full w-full relative z-10" 
                   :class="selectedCommit?.id === c.id ? 'text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-[#143B66]' : (graphOutput.get(c.id)?.dotLane === 0 ? 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-neutral-200' : 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-400 dark:text-neutral-600 group-hover:text-neutral-500')">
                   <img :src="gravatarUrl(c.authorEmail || c.author + '@localhost')" class="w-[18px] h-[18px] rounded border-2 border-neutral-200 dark:border-neutral-800 shadow-sm flex-shrink-0 object-cover" />
                   <span class="truncate">{{ c.author }}</span>
              </div>
              <div class="flex items-center truncate transition-colors pl-2 h-full w-full relative z-10" 
                   :class="selectedCommit?.id === c.id ? 'text-blue-500/80 dark:text-blue-300/50 bg-blue-100 dark:bg-[#143B66]' : (graphOutput.get(c.id)?.dotLane === 0 ? 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-500 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300' : 'bg-neutral-50 dark:bg-[#181818] group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800/50 text-neutral-400/70 dark:text-neutral-600 group-hover:text-neutral-500')">
                   {{ formatDate(c.timestamp, generalSettings.dateFormat) }}
              </div>
            </div>
          </div>
        </div>
        
      </SimpleBar>

      <!-- Scroll to Top Button -->
      <button v-show="showScrollToTop" @click="scrollToTop"
              class="absolute bottom-4 right-4 bg-white dark:bg-[#252526] border border-neutral-200 dark:border-neutral-700 shadow-lg text-neutral-600 dark:text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 p-2 rounded-full transition-all z-20 hover:scale-105 active:scale-95 outline-none flex items-center justify-center w-10 h-10"
              title="Scroll to Top">
         <Icon icon="lucide:arrow-up-to-line" class="text-xl" />
      </button>

      <div id="terminal-target-history" class="w-full flex-shrink-0 flex flex-col z-30 relative bg-[#1E1E1E]"></div>
    </div>

    <!-- Details Column -->
    <div class="flex flex-col bg-white dark:bg-[#2D2D2D] border-l border-neutral-200 dark:border-transparent flex-shrink-0 relative shadow-none dark:shadow-2xl z-10" v-if="selectedCommit" :style="{ width: detailsWidth + 'px' }">
      <div class="absolute left-0 top-0 bottom-0 w-1 -translate-x-1 cursor-col-resize hover:bg-blue-500 z-20 transition-colors" @mousedown="startResize('details', $event)"></div>
      
      <!-- Tabs Header -->
      <div class="flex-shrink-0 bg-neutral-100 dark:bg-[#252526] border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-1">
          <div class="flex gap-1">
              <button v-for="tab in ['information', 'changes', 'files']" :key="tab"
                      @click="activeDetailTab = tab"
                      class="px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all outline-none"
                      :class="activeDetailTab === tab ? 'border-blue-500 text-neutral-100' : 'border-transparent text-neutral-500 hover:text-neutral-300'">
                  {{ tab.toUpperCase() }}
              </button>
          </div>
          <button @click="selectedCommit = null" class="text-neutral-500 hover:text-neutral-300 pr-3 transition-colors outline-none" title="Close Details">
              <Icon icon="lucide:x" class="text-lg" />
          </button>
      </div>

      <div class="flex-1 bg-white dark:bg-[#242424] overflow-y-auto overflow-x-hidden">
          <!-- Information Tab -->
          <div v-if="activeDetailTab === 'information'" class="p-6 flex flex-col gap-6 animate-in fade-in duration-300">
            <!-- Header: Authors -->
            <div class="grid grid-cols-2 gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
                <div class="flex items-center gap-3">
                  <div class="relative flex-shrink-0">
                    <img :src="gravatarUrl(selectedCommit.authorEmail)" class="w-12 h-12 rounded border-2 border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-lg object-cover" />
                    <div class="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white dark:border-[#242424]"></div>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-widest mb-0.5">Author</div>
                    <div class="font-bold text-black dark:text-neutral-100 text-xs min-w-0 w-full break-normal" :title="selectedCommit.author">
                       {{ selectedCommit.author }}
                    </div>
                    <div class="text-neutral-400 dark:text-neutral-500 font-normal text-xs mb-1 min-w-0 w-full break-all" :title="selectedCommit.authorEmail">
                       &lt;{{ selectedCommit.authorEmail }}&gt;
                    </div>
                    <div class="text-[10px] text-neutral-500">{{ formatFullDate(selectedCommit.timestamp).split(' ')[0] }}</div>
                  </div>
                </div>

                <div class="flex items-center gap-3" v-if="(selectedCommit.committer && selectedCommit.committer !== selectedCommit.author) || (selectedCommit.committerEmail && selectedCommit.committerEmail !== selectedCommit.authorEmail)">
                  <div v-if="selectedCommit.committer?.toLowerCase() === 'github' || selectedCommit.committerEmail?.toLowerCase().includes('github')" class="w-12 h-12 rounded bg-neutral-200 dark:bg-[#24292e] text-black dark:text-white flex items-center justify-center border-2 border-neutral-300 dark:border-neutral-800 shadow-lg opacity-80 flex-shrink-0">
                      <Icon icon="mdi:github" class="text-3xl" />
                  </div>
                  <div v-else-if="selectedCommit.committer?.toLowerCase() === 'gitlab' || selectedCommit.committerEmail?.toLowerCase().includes('gitlab')" class="w-12 h-12 rounded bg-[#e24329] text-white flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-800 shadow-lg opacity-80 flex-shrink-0">
                      <Icon icon="mdi:gitlab" class="text-3xl" />
                  </div>
                  <div v-else-if="selectedCommit.committer?.toLowerCase() === 'bitbucket' || selectedCommit.committerEmail?.toLowerCase().includes('bitbucket')" class="w-12 h-12 rounded bg-[#0052cc] text-white flex items-center justify-center border-2 border-neutral-200 dark:border-neutral-800 shadow-lg opacity-80 flex-shrink-0">
                      <Icon icon="mdi:bitbucket" class="text-3xl" />
                  </div>
                  <img v-else :src="gravatarUrl(selectedCommit.committerEmail || selectedCommit.authorEmail)" class="w-12 h-12 rounded border-2 border-neutral-200 dark:border-neutral-800 shadow-lg opacity-80 object-cover flex-shrink-0" />
                  
                  <div class="flex flex-col min-w-0">
                    <div class="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-0.5">Committer</div>
                    <div class="font-bold text-neutral-300 dark:text-neutral-300 text-xs min-w-0 w-full break-normal" :title="selectedCommit.committer || selectedCommit.author">
                       {{ selectedCommit.committer || selectedCommit.author }}
                    </div>
                    <div v-if="selectedCommit.committerEmail" class="text-neutral-500 font-normal text-xs mb-1 min-w-0 w-full break-all" :title="selectedCommit.committerEmail">
                       &lt;{{ selectedCommit.committerEmail }}&gt;
                    </div>
                    <div class="text-[10px] text-neutral-600">{{ formatFullDate(selectedCommit.committerTimestamp || selectedCommit.timestamp).split(' ')[0] }}</div>
                  </div>
                </div>
            </div>

            <!-- Metadata Grid -->
            <div class="flex flex-col gap-4 text-[11px]">
                <div class="flex items-start">
                   <div class="w-20 flex-shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-0.5">SHA</div>
                   <div class="flex-1 flex items-center gap-2 group">
                      <span class="font-mono text-neutral-700 dark:text-neutral-300 break-all bg-neutral-100 dark:bg-[#1E1E1E] px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800">{{ selectedCommit.id }}</span>
                      <Icon icon="lucide:copy" class="text-neutral-400 dark:text-neutral-600 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100" />
                   </div>
                </div>

                <div v-if="selectedCommit.parents && selectedCommit.parents.length" class="flex items-start">
                   <div class="w-20 flex-shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-0.5">Parents</div>
                   <div class="flex-1 flex flex-wrap gap-2">
                      <button v-for="p in selectedCommit.parents" :key="p.id" 
                              @click="navigateToCommit(p)"
                              class="text-blue-400 font-mono hover:text-blue-300 transition-colors border-b border-blue-900 border-dashed">
                        {{ p.id.substring(0, 8) }}
                      </button>
                   </div>
                </div>

                <div v-if="(commitRefsMap.get(selectedCommit.id) || []).length > 0" class="flex items-start">
                   <div class="w-20 flex-shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-0.5">Refs</div>
                   <div class="flex-1 flex flex-wrap gap-2">
                      <span v-for="ref in commitRefsMap.get(selectedCommit.id)" :key="ref.name" 
                            class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border"
                            :class="[
                              ref.type === 'branch' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' : 
                              ref.type === 'remote' ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' :
                              'bg-yellow-900/20 text-yellow-500 border-yellow-500/30'
                            ]">
                         <Icon :icon="ref.isHead ? 'lucide:check-circle-2' : (ref.type === 'branch' ? 'lucide:git-branch' : (ref.type === 'remote' ? 'lucide:cloud' : 'lucide:tag'))" class="text-[10px]" />
                         {{ ref.name }}
                      </span>
                   </div>
                </div>

                <div class="flex items-start">
                   <div class="w-20 flex-shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-0.5">Message</div>
                   <div class="flex-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
                      <div class="font-bold text-black dark:text-neutral-100 mb-2 text-xs">{{ selectedCommit.summary }}</div>
                      <div v-html="renderMessageLinks(selectedCommit.message || '')" @click="handleLinkClick"></div>
                   </div>
                </div>

                <div v-if="commitFilesList.length" class="flex flex-col gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800">
                    <div class="text-neutral-500 font-bold uppercase tracking-widest text-[9px]">{{ commitFilesList.length }} Changed Files</div>
                    <div class="flex flex-col gap-1">
                        <div v-for="file in commitFilesList.slice(0, 15)" :key="file.path" 
                             @click="activeDetailTab = 'changes'; selectedCommitFile = file.path"
                             class="flex items-center gap-2 group cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 p-1 px-2 rounded transition-colors">
                            <Icon :icon="getStatusIcon(file.status)" 
                                  :class="getStatusColor(file.status)" 
                                  class="text-[12px]" />
                            <span class="text-[11px] text-neutral-600 dark:text-neutral-400 truncate group-hover:text-blue-500">{{ file.path }}</span>
                        </div>
                        <div v-if="commitFilesList.length > 15" class="text-[10px] text-neutral-500 italic pl-2 pt-1">
                            ... and {{ commitFilesList.length - 15 }} more. See CHANGES tab for all.
                        </div>
                    </div>
                </div>
            </div>
          </div>

          <div v-else-if="activeDetailTab === 'files'" class="h-full flex flex-col min-h-0 animate-in fade-in duration-300 bg-[#1A1A1A] overflow-hidden">
             <div class="flex-1 flex overflow-hidden">
                <SimpleBar class="w-64 border-r border-neutral-800 bg-[#1A1A1A] flex-shrink-0" style="height: 100%;">
                   <FileTree v-if="fullRepoFilesList.length" :files="fullRepoFilesList" :selectedPath="selectedFilesTabPath" @select="selectedFilesTabPath = $event" />
                   <div v-else-if="isTreeLoading" class="p-8 text-center">
                       <Icon icon="lucide:loader-2" class="animate-spin text-blue-500 mx-auto mb-2" />
                       <span class="text-[9px] text-neutral-500 uppercase font-bold tracking-widest">Loading Tree...</span>
                   </div>
                   <div v-else-if="!isTreeLoading" class="p-8 text-center text-neutral-600 uppercase text-[9px] font-bold tracking-widest opacity-50">
                       Empty repository tree
                   </div>
                </SimpleBar>
                <div class="flex-1 flex flex-col min-w-0">
                   <DiffViewer v-if="selectedFilesTabPath" :original="''" :modified="filesTabContent" :filename="selectedFilesTabPath" :readOnly="true" />
                   <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8 bg-[#1e1e1e]">
                       <Icon icon="lucide:file-text" class="text-5xl mb-4 opacity-10" />
                       <div class="font-bold uppercase tracking-widest text-sm opacity-20">Select a file from the repository</div>
                   </div>
                </div>
             </div>
          </div>
          <div v-else-if="activeDetailTab === 'changes'" class="h-full flex flex-col min-h-0 animate-in fade-in duration-300 flex-1 overflow-hidden">
             <div class="flex-1 flex overflow-hidden">
                <SimpleBar class="w-64 border-r border-neutral-800 bg-[#1A1A1A] flex-shrink-0" style="height: 100%;">
                   <FileTree :files="commitFilesList" :selectedPath="selectedCommitFile" @select="selectedCommitFile = $event" />
                </SimpleBar>
                <div class="flex-1 flex flex-col min-w-0">
                   <DiffViewer v-if="selectedCommitFile" :original="commitOriginal" :modified="commitModified" :filename="selectedCommitFile" />
                   <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8 bg-[#1e1e1e]">
                       <Icon icon="lucide:file-diff" class="text-5xl mb-4 opacity-10" />
                       <div class="font-bold uppercase tracking-widest text-sm opacity-20">Select a file from changes</div>
                   </div>
                </div>
             </div>
          </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { 
  repoPath,
  stashes, 
  selectedStash, 
  selectedStashFile,
  stashApply,
  stashPop,
  dropStash
} from '../../services/gitService';
import { layoutRefs } from '../../services/layoutService';
import { contextMenu, requestConfirm } from '../../services/modalService';
import ScrollArea from '../../components/Common/ScrollArea.vue';
import VirtualScroll from '../../components/Common/VirtualScroll.vue';
import { formatStashDate, parseStashMessage } from '../../utils/formatters';
import DiffViewer from '../../components/Common/DiffViewer.vue';
import Resizer from '../../components/Common/Resizer.vue';
import { Stash } from '../../types/git';

import { onMounted, nextTick } from 'vue';

const { t } = useI18n();
const stashFiles = ref<any[]>([]);
const originalContent = ref('');
const modifiedContent = ref('');
const isFilesLoading = ref(false);
const containerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  if (containerRef.value) {
    const h = containerRef.value.clientHeight;
    if (h > 0) {
      layoutRefs.stashFilesHeight.value = Math.floor(h / 2);
    }
  }
});

async function loadStashFiles() {
  if (selectedStash.value && repoPath.value) {
    isFilesLoading.value = true;
    try {
      stashFiles.value = await window.gitbox.stashChanges(repoPath.value, selectedStash.value.id);
      if (stashFiles.value.length > 0 && !selectedStashFile.value) {
        selectedStashFile.value = stashFiles.value[0].path;
      }
    } catch (e) {
      stashFiles.value = [];
    } finally {
      isFilesLoading.value = false;
    }
  } else {
    stashFiles.value = [];
    selectedStashFile.value = '';
  }
}

async function loadDiff() {
  if (!repoPath.value || !selectedStash.value || !selectedStashFile.value) {
      originalContent.value = '';
      modifiedContent.value = '';
      return;
  }
  try {
    const diff = await window.gitbox.diffStashFile(repoPath.value, selectedStash.value.id, selectedStashFile.value);
    originalContent.value = diff.original ?? '';
    modifiedContent.value = diff.modified ?? '';
  } catch (e) {
      originalContent.value = '';
      modifiedContent.value = '';
  }
}

watch(selectedStash, () => {
    selectedStashFile.value = '';
    loadStashFiles();
}, { immediate: true });

watch(selectedStashFile, loadDiff, { immediate: true });

/** Apply the stash (keeps it), after confirmation. Also the default action. */
function applyStash(stash: Stash) {
  requestConfirm(t('stash.apply_title'), t('stash.apply_msg', { index: stash.index }), false, () => stashApply(stash.id));
}

/** Apply and drop the stash, after confirmation. */
function popStash(stash: Stash) {
  requestConfirm(t('stash.pop_title'), t('stash.pop_msg', { index: stash.index }), true, () => stashPop(stash.id));
}

function showStashMenu(e: MouseEvent, stash: Stash) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('stash.apply'), action: () => applyStash(stash), icon: 'lucide:check' },
      { label: t('stash.pop'), action: () => popStash(stash), icon: 'lucide:download' },
      { separator: true },
      { label: t('common.delete'), action: () => requestConfirm(t('stash.drop_title'), t('stash.drop_msg', { index: stash.index }), true, () => dropStash(stash.id)), icon: 'lucide:trash-2', danger: true },
    ]
  };
}

const getStatusIcon = (status: string) => {
    if (!status) return 'lucide:file';
    const s = status.toLowerCase();
    if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'lucide:plus';
    if (s.includes('deleted')) return 'lucide:minus';
    if (s.includes('renamed') || s.includes('moved')) return 'lucide:repeat';
    if (s.includes('modified') || s.includes('staged')) return 'lucide:file-text';
    return 'lucide:file';
};

const getStatusColor = (status: string, isSelected: boolean) => {
    if (isSelected) return 'text-accent-fg';
    if (!status) return 'text-content-muted';
    const s = status.toLowerCase();
    if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'text-green-500';
    if (s.includes('deleted')) return 'text-red-500';
    if (s.includes('renamed') || s.includes('moved')) return 'text-purple-400';
    if (s.includes('modified') || s.includes('staged')) return 'text-[#E2B93D]';
    return 'text-content-muted';
};
</script>

<template>
  <div ref="containerRef" class="flex-1 flex min-h-0 bg-app select-none text-content">
    <!-- Left Column: Stashes and Files -->
    <div class="w-[480px] border-r border-line flex flex-col flex-shrink-0 bg-app overflow-hidden">
      <!-- Stash List (Top) -->
      <div class="flex-1 flex flex-col min-h-0 bg-app relative">
        <header class="bg-surface border-b border-line px-4 py-2 text-[10px] font-bold text-content-muted uppercase tracking-widest flex items-center justify-between relative z-10">
           <div class="flex items-center gap-2">
             <Icon icon="lucide:layers" class="text-content-muted" />
             <span>{{ t('common.stashes') }} ({{ stashes.length }})</span>
           </div>
        </header>
        <VirtualScroll
            class="flex-1"
            style="height: 100%;"
            :auto-hide="false"
            :items="stashes"
            :item-height="70"
            v-slot="{ item: stashItem }"
          >
          <div
               @click="selectedStash = stashItem.data"
               @dblclick="applyStash(stashItem.data)"
               @contextmenu.prevent="showStashMenu($event, stashItem.data)"
               class="px-4 border-b border-line cursor-pointer transition-colors relative"
               style="height: 70px; display: flex; flex-direction: column; justify-content: center;"
               :class="selectedStash?.id === stashItem.data.id ? 'bg-accent text-accent-fg' : 'hover:bg-surface-hover'">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] font-bold font-mono" :class="selectedStash?.id === stashItem.data.id ? 'text-accent-fg' : 'text-accent'">stash@{ {{ stashItem.data.index }} }</span>
              <span class="text-[10px]" :class="selectedStash?.id === stashItem.data.id ? 'text-accent-fg/80' : 'text-content-muted'">{{ formatStashDate(stashItem.data.timestamp) }}</span>
            </div>
            <div class="flex items-center gap-2 overflow-hidden">
              <span v-if="parseStashMessage(stashItem.data.message).branch" class="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter"
                    :class="selectedStash?.id === stashItem.data.id ? 'bg-black/20 text-accent-fg border border-white/20' : 'bg-surface text-content-muted border border-line'">
                {{ parseStashMessage(stashItem.data.message).branch }}
              </span>
              <span class="text-[11px] truncate font-medium flex-1 min-w-0" :class="selectedStash?.id === stashItem.data.id ? 'text-accent-fg' : 'text-content-muted'">{{ parseStashMessage(stashItem.data.message).message }}</span>
            </div>
          </div>
          </VirtualScroll>
          <div v-if="stashes.length === 0" class="p-12 text-center opacity-30 mt-20">
            <Icon icon="lucide:layers" class="text-3xl mx-auto mb-3" />
            <div class="text-[9px] uppercase font-black tracking-widest">{{ t('view.no_stashes_found') }}</div>
          </div>

        <!-- Resizable Handle -->
        <Resizer vertical v-if="selectedStash" :target="(layoutRefs.stashFilesHeight as any)" :options="{ axis: 'y', invert: true, min: 120 }" class="absolute bottom-0 left-0 right-0 h-1.5 z-40 bg-line" />
      </div>

      <!-- File List (Bottom) -->
      <div v-if="selectedStash" :style="{ height: layoutRefs.stashFilesHeight.value + 'px' }" class="flex flex-col min-h-[120px] max-h-[80%] bg-app shrink-0 relative">
        <header class="bg-surface border-b border-t border-line px-4 py-2 text-[10px] font-bold text-content-muted uppercase tracking-widest flex items-center justify-between relative z-10">
           <div class="flex items-center gap-2">
             <Icon icon="lucide:layout-list" class="text-content-muted" />
             <span>{{ t('view.changes') }} ({{ stashFiles.length }})</span>
           </div>
           <Icon icon="lucide:menu" class="text-content-muted text-sm" />
        </header>
        <ScrollArea class="flex-1" style="height: 100%;" :auto-hide="false">
          <div v-if="isFilesLoading" class="p-10 text-center flex flex-col items-center gap-3">
             <Icon icon="lucide:loader-2" class="animate-spin text-accent text-xl" />
             <span class="text-[9px] text-content-muted uppercase font-black tracking-widest">{{ t('common.loading') }}</span>
          </div>
          <div v-else class="flex flex-col pb-4">
            <div v-for="file in stashFiles" :key="file.path" 
                 @click="selectedStashFile = file.path"
                 class="px-4 py-2 flex items-center gap-3 cursor-pointer group border-b border-neutral-200/10 dark:border-neutral-800/10 transition-colors"
                 :class="selectedStashFile === file.path ? 'bg-accent text-accent-fg' : 'hover:bg-surface-hover'">
              <Icon :icon="getStatusIcon(file.status)" :class="getStatusColor(file.status, selectedStashFile === file.path)" class="text-sm shrink-0" />
              <span class="text-[11px] font-medium truncate flex-1 min-w-0" :class="selectedStashFile === file.path ? 'text-accent-fg' : 'text-content-muted'">
                {{ file.path }}
              </span>
            </div>
          </div>
          <div v-if="!isFilesLoading && stashFiles.length === 0" class="p-10 text-center opacity-20">
             <span class="text-[9px] uppercase font-black tracking-widest">{{ t('view.no_stashed_changes') }}</span>
          </div>
        </ScrollArea>
      </div>
    </div>

    <!-- Right Column: Diff -->
    <div class="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative bg-app">
      <DiffViewer v-if="selectedStash && selectedStashFile"
                  class="h-full"
                  :original="originalContent"
                  :modified="modifiedContent"
                  :filename="selectedStashFile" />
      <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8">
        <Icon :icon="selectedStash ? 'lucide:file-search' : 'lucide:layers'" class="text-5xl mb-6 opacity-5" />
        <div class="font-black uppercase tracking-[0.2em] text-[9px] opacity-10">
          {{ selectedStash ? t('view.select_file_to_view_changes') : t('view.select_stash_to_browse') }}
        </div>
      </div>
    </div>
  </div>
</template>

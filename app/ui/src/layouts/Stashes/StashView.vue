<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { 
  repoPath,
  stashes, 
  selectedStash, 
  selectedStashFile,
  stashPop,
  dropStash
} from '../../services/gitService';
import { stashFilesHeight, startResize } from '../../services/layoutService';
import { contextMenu, requestConfirm } from '../../services/modalService';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';
import { formatStashDate, parseStashMessage } from '../../utils/formatters';
import DiffViewer from '../../components/Common/DiffViewer.vue';
import { Stash } from '../../types/git';

const { t } = useI18n();
const stashFiles = ref<any[]>([]);
const originalContent = ref('');
const modifiedContent = ref('');
const isFilesLoading = ref(false);

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

function showStashMenu(e: MouseEvent, stash: Stash) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: 'Apply && Drop (Pop)', action: () => stashPop(stash.id), icon: 'lucide:download' },
      { separator: true },
      { label: t('common.delete'), action: () => requestConfirm('Drop Stash', `Are you sure you want to drop stash@{${stash.index}}?`, true, () => dropStash(stash.id)), icon: 'lucide:trash-2', danger: true },
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
    if (isSelected) return 'text-white';
    if (!status) return 'text-neutral-500';
    const s = status.toLowerCase();
    if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'text-green-500';
    if (s.includes('deleted')) return 'text-red-500';
    if (s.includes('renamed') || s.includes('moved')) return 'text-purple-400';
    if (s.includes('modified') || s.includes('staged')) return 'text-[#E2B93D]';
    return 'text-neutral-500';
};
</script>

<template>
  <div class="flex-1 flex min-h-0 bg-[#1E1E1E] select-none text-neutral-300">
    <!-- Left Column: Stashes and Files -->
    <div class="w-[480px] border-r border-neutral-800 flex flex-col flex-shrink-0 bg-[#1A1A1A] overflow-hidden">
      <!-- Stash List (Top) -->
      <div class="flex-1 flex flex-col min-h-0 bg-[#1A1A1A]">
        <header class="bg-[#252526] border-b border-neutral-800 px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center justify-between relative z-10">
           <div class="flex items-center gap-2">
             <Icon icon="lucide:layers" class="text-neutral-500" />
             <span>{{ t('common.stashes') }} ({{ stashes.length }})</span>
           </div>
        </header>
        <SimpleBar class="flex-1" style="height: 100%;" :auto-hide="false">
          <div v-for="s in stashes" :key="s.id" 
               @click="selectedStash = s" 
               @contextmenu.prevent="showStashMenu($event, s)"
               class="px-4 py-3 border-b border-neutral-800/30 cursor-pointer transition-colors relative" 
               :class="selectedStash?.id === s.id ? 'bg-[#143B66] text-white' : 'hover:bg-white/5'">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] font-bold text-blue-400 font-mono">stash@{ {{ s.index }} }</span>
              <span class="text-[10px] text-neutral-500" :class="selectedStash?.id === s.id ? 'text-blue-200' : ''">{{ formatStashDate(s.timestamp) }}</span>
            </div>
            <div class="flex items-center gap-2 overflow-hidden">
              <span v-if="parseStashMessage(s.message).branch" class="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-black/30 text-neutral-400 border border-white/10 font-bold uppercase tracking-tighter">
                {{ parseStashMessage(s.message).branch }}
              </span>
              <span class="text-[11px] truncate font-medium flex-1 min-w-0" :class="selectedStash?.id === s.id ? 'text-white' : 'text-neutral-400'">{{ parseStashMessage(s.message).message }}</span>
            </div>
          </div>
          <div v-if="stashes.length === 0" class="p-12 text-center opacity-30 mt-20">
            <Icon icon="lucide:layers" class="text-3xl mx-auto mb-3" />
            <div class="text-[9px] uppercase font-black tracking-widest">No stashes found</div>
          </div>
        </SimpleBar>
      </div>

      <!-- Resizable Handle -->
      <div v-if="selectedStash" 
           class="h-1 bg-neutral-800 cursor-row-resize hover:bg-blue-500 transition-colors relative z-20 group"
           @mousedown="startResize('stashFiles', $event)">
        <div class="absolute inset-x-0 -top-2 -bottom-2"></div>
      </div>

      <!-- File List (Bottom) -->
      <div v-if="selectedStash" :style="{ height: stashFilesHeight + 'px' }" class="flex flex-col min-h-[120px] max-h-[80%] bg-[#1A1A1A] shrink-0">
        <header class="bg-[#252526] border-b border-t border-neutral-800 px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center justify-between relative z-10">
           <div class="flex items-center gap-2">
             <Icon icon="lucide:layout-list" class="text-neutral-500" />
             <span>CHANGES ({{ stashFiles.length }})</span>
           </div>
           <Icon icon="lucide:menu" class="text-neutral-500 text-sm" />
        </header>
        <SimpleBar class="flex-1" style="height: 100%;" :auto-hide="false">
          <div v-if="isFilesLoading" class="p-10 text-center flex flex-col items-center gap-3">
             <Icon icon="lucide:loader-2" class="animate-spin text-blue-500 text-xl" />
             <span class="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Loading...</span>
          </div>
          <div v-else class="flex flex-col pb-4">
            <div v-for="file in stashFiles" :key="file.path" 
                 @click="selectedStashFile = file.path"
                 class="px-4 py-2 flex items-center gap-3 cursor-pointer group border-b border-neutral-800/10 transition-colors"
                 :class="selectedStashFile === file.path ? 'bg-[#143B66] text-white' : 'hover:bg-white/5'">
              <Icon :icon="getStatusIcon(file.status)" :class="getStatusColor(file.status, selectedStashFile === file.path)" class="text-sm shrink-0" />
              <span class="text-[11px] font-medium truncate flex-1 min-w-0" :class="selectedStashFile === file.path ? 'text-white' : 'text-neutral-400'">
                {{ file.path }}
              </span>
            </div>
          </div>
          <div v-if="!isFilesLoading && stashFiles.length === 0" class="p-10 text-center opacity-20">
             <span class="text-[9px] uppercase font-black tracking-widest">No stashed changes</span>
          </div>
        </SimpleBar>
      </div>
    </div>

    <!-- Right Column: Diff -->
    <div class="flex-1 flex flex-col min-h-0 relative bg-[#1E1E1E]">
      <DiffViewer v-if="selectedStash && selectedStashFile" 
                  :original="originalContent" 
                  :modified="modifiedContent" 
                  :filename="selectedStashFile" />
      <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8">
        <Icon :icon="selectedStash ? 'lucide:file-search' : 'lucide:layers'" class="text-5xl mb-6 opacity-5" />
        <div class="font-black uppercase tracking-[0.2em] text-[9px] opacity-10">
          {{ selectedStash ? 'Select a file to view changes' : 'Select a stash to browse content' }}
        </div>
      </div>
    </div>
  </div>
</template>

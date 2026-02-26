<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { 
  repoPath,
  stashes, 
  selectedStash, 
  selectedStashFile,
} from '../../services/gitService';
import { formatDistanceToNow } from '../../utils/formatters';
import DiffViewer from '../../components/Common/DiffViewer.vue';
import FileTree from '../../components/Common/FileTree.vue';

const { t } = useI18n();
const stashFiles = ref<any[]>([]);
const originalContent = ref('');
const modifiedContent = ref('');

async function loadStashFiles() {
  if (selectedStash.value && repoPath.value) {
    stashFiles.value = await window.gitbox.stashChanges(repoPath.value, selectedStash.value.id);
    if (stashFiles.value.length > 0 && !selectedStashFile.value) {
      selectedStashFile.value = stashFiles.value[0].path;
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
</script>

<template>
  <div class="flex-1 flex min-h-0 bg-white dark:bg-[#1E1E1E]">
    <!-- Left Column: Stashes and Files -->
    <div class="w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50 dark:bg-[#181818] flex-shrink-0">
      <!-- Stash List (Top) -->
      <div class="flex-1 flex flex-col min-h-0 border-b border-neutral-200 dark:border-neutral-800">
        <header class="bg-neutral-100 dark:bg-[#2D2D2D] border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon icon="lucide:layers" class="text-neutral-500" />
            <span>{{ t('common.stashes') }}</span>
          </div>
          <span class="bg-neutral-700 px-1.5 rounded-full text-[9px]">{{ stashes.length }}</span>
        </header>
        <div class="flex-1 overflow-y-auto overflow-x-hidden">
          <div v-for="s in stashes" :key="s.id" 
               @click="selectedStash = s" 
               class="p-3 border-b border-neutral-200 dark:border-neutral-800/50 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group relative" 
               :class="selectedStash?.id === s.id ? 'bg-blue-100 dark:bg-[#143B66]' : ''">
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 scale-y-0 transition-transform origin-top"
                 :class="selectedStash?.id === s.id ? 'scale-y-100' : ''"></div>
            <div class="flex items-center justify-between mb-1">
              <div class="text-[11px] font-bold text-yellow-600 dark:text-yellow-500 font-mono">stash@{ {{ s.index }} }</div>
              <div class="text-[9px] text-neutral-500 dark:text-neutral-600 group-hover:dark:text-neutral-500">{{ formatDistanceToNow(s.timestamp) }}</div>
            </div>
            <div class="text-[11px] truncate text-neutral-700 dark:text-neutral-300" :class="selectedStash?.id === s.id ? 'text-black dark:text-white' : ''">{{ s.message }}</div>
          </div>
          <div v-if="stashes.length === 0" class="p-8 text-center text-xs text-neutral-600 italic uppercase font-bold tracking-widest">
            {{ t('common.stashes') }} EMPTY
          </div>
        </div>
      </div>

      <!-- File List (Bottom) -->
      <div v-if="selectedStash" class="h-1/2 flex flex-col min-h-0 animate-in slide-in-from-bottom-2 duration-200">
        <header class="bg-neutral-100 dark:bg-[#2D2D2D] border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest flex items-center gap-2">
           <Icon icon="lucide:file-stack" class="text-neutral-500 dark:text-neutral-500" />
           <span>Stashed Changes</span>
        </header>
        <div class="flex-1 bg-white dark:bg-[#1A1A1A] overflow-y-auto overflow-x-hidden">
          <FileTree :files="stashFiles" :selectedPath="selectedStashFile" @select="selectedStashFile = $event" />
        </div>
      </div>
      <div id="terminal-target-stashes" class="w-full flex-shrink-0 flex flex-col z-30 relative bg-[#1E1E1E]"></div>
    </div>

    <!-- Right Column: Diff -->
    <div class="flex-1 flex flex-col min-h-0 relative">
      <DiffViewer v-if="selectedStash && selectedStashFile" 
                  :original="originalContent" 
                  :modified="modifiedContent" 
                  :filename="selectedStashFile" />
      <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8">
        <Icon :icon="selectedStash ? 'lucide:file-search' : 'lucide:layers'" class="text-5xl mb-4 opacity-10" />
        <div class="font-bold uppercase tracking-widest text-sm opacity-20">
          {{ selectedStash ? 'Select a file to view changes' : 'Select a stash to browse content' }}
        </div>
      </div>
    </div>
  </div>
</template>

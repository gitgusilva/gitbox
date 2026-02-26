<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { 
  repoPath,
  unstagedFiles, 
  stagedFiles, 
  selectedFile, 
  commitMessage,
  stageAll,
  unstageAll,
  commitAll,
} from '../../services/gitService';
import { 
  statusWidth, 
  unstagedHeight, 
  startResize 
} from '../../services/layoutService';
import DiffViewer from '../../components/Common/DiffViewer.vue';
import FileTree from '../../components/Common/FileTree.vue';

const { t } = useI18n();

const originalContent = ref('');
const modifiedContent = ref('');

async function loadDiff() {
  if (!repoPath.value || !selectedFile.value) {
    originalContent.value = '';
    modifiedContent.value = '';
    return;
  }
  try {
    const diff = await window.gitbox.diffFile(repoPath.value, selectedFile.value);
    originalContent.value = diff.original ?? '';
    modifiedContent.value = diff.modified ?? '';
  } catch (e) {
    originalContent.value = '';
    modifiedContent.value = '';
  }
}

watch(selectedFile, loadDiff);

onMounted(() => {
  nextTick(loadDiff);
});

const allChangedFiles = computed(() => [...stagedFiles.value, ...unstagedFiles.value]);

function isConflicted(filePath: string) {
  const file = allChangedFiles.value.find(f => f.path === filePath);
  return file && file.status.includes('conflicted');
}

async function handleSaveMerge(newContent: string) {
  if (repoPath.value && selectedFile.value) {
    try {
      await window.gitbox.saveFile(repoPath.value, selectedFile.value, newContent);
      await window.gitbox.stageAll(repoPath.value); // could just stage this file, but stageAll is accessible
      // Ideally we would trigger a refresh of status here
      await loadDiff();
    } catch (err) {
      console.error('Failed to save merge resolution:', err);
    }
  }
}
</script>

<template>
  <div class="flex-1 flex min-h-0">
    <div class="flex flex-col border-r border-neutral-800 bg-[#181818] flex-shrink-0 relative select-none" :style="{ width: statusWidth + 'px' }">
       <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 transition-colors" @mousedown="startResize('status', $event)"></div>
       
       <!-- Unstaged -->
       <header class="bg-[#2D2D2D] border-b border-neutral-800 px-3 py-2 text-[10px] font-bold text-neutral-400 flex justify-between uppercase tracking-widest items-center">
         <div class="flex items-center gap-2">
           <Icon icon="lucide:file-warning" class="text-neutral-500" />
           <span>{{ t('changes.unstaged') }}</span>
         </div>
         <div class="flex items-center gap-2">
           <span class="bg-neutral-800 px-1.5 rounded text-[9px]">{{ unstagedFiles.length }}</span>
           <button @click="stageAll" class="hover:text-green-400 transition-colors" title="Stage All">
             <Icon icon="lucide:plus-circle" class="text-xs" />
           </button>
         </div>
       </header>
       
       <div :style="{ height: unstagedHeight + 'px' }" class="flex-shrink-0 bg-[#1A1A1A] overflow-y-auto overflow-x-hidden">
          <FileTree :files="unstagedFiles" :selectedPath="selectedFile" @select="selectedFile = $event" />
       </div>
       
       <div class="h-1 bg-neutral-800 cursor-row-resize hover:bg-blue-500 transition-colors relative z-10" @mousedown="startResize('unstaged', $event)">
         <div class="absolute inset-x-0 -top-2 -bottom-2"></div>
       </div>
       
       <!-- Staged -->
       <header class="bg-[#2D2D2D] border-b border-t border-neutral-800 px-3 py-2 text-[10px] font-bold text-neutral-400 flex justify-between uppercase tracking-widest items-center">
         <div class="flex items-center gap-2">
           <Icon icon="lucide:check-circle-2" class="text-neutral-500" />
           <span>{{ t('changes.staged') }}</span>
         </div>
         <div class="flex items-center gap-2">
           <span class="bg-blue-900/40 text-blue-400 px-1.5 rounded text-[9px]">{{ stagedFiles.length }}</span>
           <button @click="unstageAll" class="hover:text-red-400 transition-colors" title="Unstage All">
             <Icon icon="lucide:minus-circle" class="text-xs" />
           </button>
         </div>
       </header>
       
       <div class="flex-1 bg-[#1A1A1A] overflow-y-auto overflow-x-hidden">
          <FileTree :files="stagedFiles" :selectedPath="selectedFile" @select="selectedFile = $event" />
       </div>
       <div id="terminal-target-local_changes" class="w-full flex-shrink-0 flex flex-col z-30 relative bg-[#1E1E1E]"></div>
    </div>
    
    <div class="flex-1 flex flex-col bg-[#1E1E1E] relative">
      <div class="flex-1 flex flex-col min-h-0 relative">
        <DiffViewer v-if="selectedFile" 
                    :original="originalContent" 
                    :modified="modifiedContent" 
                    :filename="selectedFile"
                    :readOnly="!isConflicted(selectedFile)"
                    @save="handleSaveMerge" />
        <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8">
          <Icon icon="lucide:file-diff" class="text-5xl mb-4 opacity-10" />
          <div class="font-bold uppercase tracking-widest text-sm opacity-20">
            {{ t('changes.select_file_diff') }}
          </div>
        </div>
      </div>
       <!-- Commit Area -->
       <div class="p-3 border-t border-neutral-800 bg-[#252526] flex flex-col gap-2 flex-shrink-0">
         <div class="relative">
           <textarea v-model="commitMessage" 
                     class="w-full h-24 bg-[#1E1E1E] border border-neutral-700 p-3 text-xs text-neutral-200 outline-none resize-none focus:border-blue-500 rounded transition-all placeholder:text-neutral-600 leading-relaxed" 
                     :placeholder="t('changes.commit_placeholder')"></textarea>
         </div>
         <button @click="commitAll" 
                 class="bg-blue-600 hover:bg-blue-500 text-white py-2 text-xs font-bold rounded transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-blue-900/20 active:scale-[0.98] flex items-center justify-center gap-2 uppercase tracking-widest" 
                 :disabled="!commitMessage.trim() || stagedFiles.length === 0">
           <Icon icon="lucide:git-commit" />
           {{ t('changes.commit') }}
         </button>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';
import { 
  repoPath,
  unstagedFiles, 
  stagedFiles, 
  selectedFile, 
  selectedFiles,
  commitMessage,
  stageAll,
  stageFile,
  unstageAll,
  unstageFile,
  discardAll,
  discardFile,
  commitAll,
  includeUntracked
} from '../../services/gitService';
import { 
  statusWidth, 
  unstagedHeight, 
  startResize 
} from '../../services/layoutService';
import DiffViewer from '../../components/Common/DiffViewer.vue';
import MergeViewer from '../../components/Common/MergeViewer.vue';
import FileTree from '../../components/Common/FileTree.vue';
import { generateCommitMessage, explainChanges } from '../../services/ai';
import { getItem, setItem } from '../../services/storageService';
import { contextMenu, requestConfirm } from '../../services/modalService';

const unstagedViewMode = ref(getItem('gitbox_unstaged_view_mode') || 'tree');
const stagedViewMode = ref(getItem('gitbox_staged_view_mode') || 'tree');

function setViewMode(panel: 'unstaged' | 'staged', mode: string) {
  if (panel === 'unstaged') {
    unstagedViewMode.value = mode;
    setItem('gitbox_unstaged_view_mode', mode);
  } else {
    stagedViewMode.value = mode;
    setItem('gitbox_staged_view_mode', mode);
  }
  contextMenu.value = null;
}

function openViewMenu(e: MouseEvent, panel: 'unstaged' | 'staged') {
  const currentMode = panel === 'unstaged' ? unstagedViewMode.value : stagedViewMode.value;
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { 
        label: 'Show as Path List', 
        icon: 'lucide:menu', 
        active: currentMode === 'list',
        action: () => setViewMode(panel, 'list') 
      },
      { 
        label: 'Show as File and Dir List', 
        icon: 'lucide:layout-grid', 
        active: currentMode === 'flat',
        action: () => setViewMode(panel, 'flat') 
      },
      { 
        label: 'Show as Filesystem Tree', 
        icon: 'lucide:git-branch', 
        active: currentMode === 'tree',
        action: () => setViewMode(panel, 'tree') 
      },
    ]
  };
}

async function moveSelected(toStaged: boolean) {
  if (selectedFiles.value.length === 0) return;
  const files = [...selectedFiles.value];
  for (const f of files) {
    if (toStaged) await stageFile(f);
    else await unstageFile(f);
  }
}

async function handleDiscard(path?: string) {
  const targets = (path ? [path] : [...selectedFiles.value]).filter(Boolean);
  if (targets.length === 0) return;
  
  const msg = targets.length === 1 
    ? `Discard changes in ${targets[0]}?` 
    : `Discard changes in ${targets.length} files?`;

  requestConfirm('Discard Changes', 'You can\'t undo this action!!!', true, async () => {
    for (const f of targets) {
      await discardFile(f);
    }
  });
}

function openContextMenu(e: MouseEvent, panel: 'unstaged' | 'staged', path?: string) {
  if (path && !selectedFiles.value.includes(path)) {
    selectedFiles.value = [path];
    selectedFile.value = path;
  }
  
  const isStaged = panel === 'staged';
  
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: 'Open in Merge Tool', icon: 'lucide:git-merge', shortcut: 'Ctrl+Shift+D', action: () => {} },
      { label: 'Open with...', icon: 'lucide:external-link', shortcut: 'Ctrl+O', action: () => {} },
      { label: 'Reveal in File Explorer', icon: 'lucide:folder-search', action: () => {} },
      { type: 'separator' },
      isStaged 
        ? { label: 'Unstage', icon: 'lucide:minus', shortcut: 'Enter/Space', action: () => moveSelected(false) }
        : { label: 'Stage', icon: 'lucide:plus', shortcut: 'Enter/Space', action: () => moveSelected(true) },
      !isStaged ? { label: 'Discard...', icon: 'lucide:undo-2', shortcut: 'Back/Delete', action: () => handleDiscard(path) } : null,
      { label: 'Stash...', icon: 'lucide:package', action: () => {} },
      { label: 'Save as Patch...', icon: 'lucide:file-text', action: () => {} },
      !isStaged ? { label: 'Assume unchanged', icon: 'lucide:eye-off', action: () => {} } : null,
      isStaged ? { label: 'Generate commit message', icon: 'lucide:wand-2', action: () => handleGenerateCommit() } : null,
      { type: 'separator' },
      { label: 'File History', icon: 'lucide:history', action: () => {} },
      { label: 'Blame (HEAD-only)', icon: 'lucide:user-check', action: () => {} },
      { type: 'separator' },
      { label: 'Copy Path', icon: 'lucide:copy', shortcut: 'Ctrl+C', action: () => {
        if (selectedFile.value) navigator.clipboard.writeText(selectedFile.value);
      }},
      { label: 'Copy Full Path', icon: 'lucide:copy', shortcut: 'Ctrl+Shift+C', action: () => {
         if (repoPath.value && selectedFile.value) {
           const fullPath = repoPath.value + '/' + selectedFile.value;
           navigator.clipboard.writeText(fullPath);
         }
      }},
    ].filter(Boolean)
  };
}

function toggleUntracked() {
  includeUntracked.value = !includeUntracked.value;
  setItem('gitbox_include_untracked', includeUntracked.value ? 'true' : 'false');
}

const { t, locale } = useI18n();

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

function handleSelect(path: string, event?: MouseEvent) {
  if (event && (event.ctrlKey || event.metaKey)) {
    if (selectedFiles.value.includes(path)) {
      selectedFiles.value = selectedFiles.value.filter(p => p !== path);
    } else {
      selectedFiles.value.push(path);
    }
  } else if (event && event.shiftKey && selectedFiles.value.length > 0) {
    const last = selectedFiles.value[selectedFiles.value.length - 1];
    const all = allChangedFiles.value.map(f => f.path);
    const start = all.indexOf(last);
    const end = all.indexOf(path);
    if (start !== -1 && end !== -1) {
      const range = all.slice(Math.min(start, end), Math.max(start, end) + 1);
      selectedFiles.value = Array.from(new Set([...selectedFiles.value, ...range]));
    }
  } else {
    selectedFiles.value = [path];
  }
  selectedFile.value = path;
}

async function handleDblClick(path: string) {
  const targets = selectedFiles.value.includes(path) ? [...selectedFiles.value] : [path];
  const isStaged = stagedFiles.value.some(f => f.path === path);
  
  for (const p of targets) {
    if (isStaged) {
      await unstageFile(p);
    } else {
      await stageFile(p);
    }
  }
}

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

const isGeneratingCommit = ref(false);
const isExplainingChanges = ref(false);
const aiExplanation = ref('');
const showAiPanel = ref(false);

const hasAiConfig = computed(() => !!getItem('gitbox_ai_api_key'));

async function handleGenerateCommit() {
  if (!repoPath.value || stagedFiles.value.length === 0) return;
  
  isGeneratingCommit.value = true;
  try {
    const diff = await window.gitbox.getStagedDiff(repoPath.value);
    const result = await generateCommitMessage(diff, locale.value);
    if (result.text) {
      commitMessage.value = result.text;
    } else if (result.error) {
      alert(result.error);
    }
  } finally {
    isGeneratingCommit.value = false;
  }
}

async function handleExplainChanges() {
  if (!repoPath.value || !selectedFile.value) return;
  
  isExplainingChanges.value = true;
  showAiPanel.value = true;
  aiExplanation.value = 'Generating explanation...';
  
  try {
    const diff = await window.gitbox.getFileDiff(repoPath.value, selectedFile.value);
    const result = await explainChanges(diff, locale.value);
    if (result.text) {
      aiExplanation.value = result.text;
    } else if (result.error) {
      aiExplanation.value = `Error: ${result.error}`;
    }
  } finally {
    isExplainingChanges.value = false;
  }
}
</script>

<template>
  <div class="flex-1 flex min-h-0 bg-[#1E1E1E]">
    <div class="flex flex-col border-r border-neutral-800 bg-[#181818] flex-shrink-0 relative select-none h-full min-h-0" :style="{ width: statusWidth + 'px' }">
       <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 transition-colors" @mousedown="startResize('status', $event)"></div>
       
       <!-- Unstaged -->
       <header class="bg-[#2D2D2D] border-b border-neutral-800 px-3 py-2 text-[10px] font-bold text-neutral-400 flex justify-between uppercase tracking-widest items-center">
         <div class="flex items-center gap-2">
           <Icon icon="lucide:file-warning" class="text-neutral-500" />
           <span>{{ t('changes.unstaged') }} ({{ unstagedFiles.length }})</span>
         </div>
         <div class="flex items-center gap-1">
           <button @click="toggleUntracked" class="w-6 h-6 flex items-center justify-center transition-colors" :class="includeUntracked ? 'text-blue-400' : 'text-neutral-500 hover:text-white'" title="Include Untracked Files">
             <Icon :icon="includeUntracked ? 'lucide:eye' : 'lucide:eye-off'" class="text-xs" />
           </button>
           <button @click="openViewMenu($event, 'unstaged')" class="w-6 h-6 flex items-center justify-center hover:text-white transition-colors" title="View Options">
             <Icon icon="lucide:layout-grid" class="text-xs" />
           </button>
           <button @click="moveSelected(true)" :disabled="selectedFiles.length === 0" class="w-6 h-6 flex items-center justify-center hover:text-blue-400 disabled:opacity-30 transition-colors" title="Stage Selected">
             <Icon icon="lucide:chevron-down" class="text-sm" />
           </button>
           <button @click="stageAll" class="w-6 h-6 flex items-center justify-center hover:text-green-400 transition-colors" title="Stage All">
             <Icon icon="lucide:chevrons-down" class="text-sm" />
           </button>
           <button @click="openViewMenu($event, 'unstaged')" class="w-6 h-6 flex items-center justify-center hover:text-white transition-colors" title="Options">
             <Icon icon="lucide:menu" class="text-xs" />
           </button>
         </div>
       </header>
       
       <SimpleBar :style="{ height: unstagedHeight + 'px' }" class="flex-shrink-0 bg-[#1A1A1A] border-b border-neutral-800/20 shadow-inner" @contextmenu.prevent="openContextMenu($event, 'unstaged')">
          <FileTree :files="unstagedFiles" :viewMode="unstagedViewMode" :selectedPath="selectedFile" :selectedPaths="selectedFiles" 
                    @select="handleSelect" @dblclick="handleDblClick" @contextmenu="(p, e) => openContextMenu(e, 'unstaged', p)" />
       </SimpleBar>
       
       <div class="h-1 bg-neutral-800/50 cursor-row-resize hover:bg-blue-500 transition-colors relative z-10" @mousedown="startResize('unstaged', $event)">
         <div class="absolute inset-x-0 -top-2 -bottom-2"></div>
       </div>
       
       <!-- Staged -->
       <header class="bg-[#2D2D2D] border-b border-t border-neutral-800 px-3 py-2 text-[10px] font-bold text-neutral-400 flex justify-between uppercase tracking-widest items-center">
         <div class="flex items-center gap-2">
           <Icon icon="lucide:check-circle-2" class="text-neutral-500" />
           <span>{{ t('changes.staged') }} ({{ stagedFiles.length }})</span>
         </div>
         <div class="flex items-center gap-1">
           <button @click="openViewMenu($event, 'staged')" class="w-6 h-6 flex items-center justify-center hover:text-white transition-colors" title="View Options">
             <Icon icon="lucide:layout-grid" class="text-xs" />
           </button>
           <button @click="moveSelected(false)" :disabled="selectedFiles.length === 0" class="w-6 h-6 flex items-center justify-center hover:text-blue-400 disabled:opacity-30 transition-colors" title="Unstage Selected">
             <Icon icon="lucide:chevron-up" class="text-sm" />
           </button>
           <button @click="unstageAll" class="w-6 h-6 flex items-center justify-center hover:text-red-400 transition-colors" title="Unstage All">
             <Icon icon="lucide:chevrons-up" class="text-sm" />
           </button>
           <button @click="openViewMenu($event, 'staged')" class="w-6 h-6 flex items-center justify-center hover:text-white transition-colors" title="Options">
             <Icon icon="lucide:menu" class="text-xs" />
           </button>
         </div>
       </header>
       
       <SimpleBar class="flex-1 bg-[#1A1A1A] min-h-0 shadow-inner" @contextmenu.prevent="openContextMenu($event, 'staged')">
          <FileTree :files="stagedFiles" :viewMode="stagedViewMode" :selectedPath="selectedFile" :selectedPaths="selectedFiles" 
                    @select="handleSelect" @dblclick="handleDblClick" @contextmenu="(p, e) => openContextMenu(e, 'staged', p)" />
       </SimpleBar>
       <div id="terminal-target-local_changes" class="w-full flex-shrink-0 flex flex-col z-30 relative bg-[#1E1E1E] max-h-[50%]"></div>
    </div>
    
    <div class="flex-1 flex flex-col bg-[#1E1E1E] relative">
      <div class="flex-1 flex flex-col min-h-0 relative">
        <template v-if="selectedFile">
            <MergeViewer v-if="isConflicted(selectedFile)"
                        :original="originalContent" 
                        :modified="modifiedContent" 
                        :filename="selectedFile"
                        @save="handleSaveMerge" />
            <DiffViewer v-else
                        :original="originalContent" 
                        :modified="modifiedContent" 
                        :filename="selectedFile"
                        :readOnly="true" />
        </template>
        
        <!-- AI Toolbar for Diff -->
        <div v-if="selectedFile && hasAiConfig" class="absolute top-3 right-5 flex gap-2">
          <button @click="handleExplainChanges" 
                  class="flex items-center gap-2 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/5 rounded-full text-[10px] font-bold text-neutral-300 hover:text-blue-400 transition-all shadow-xl"
                  :disabled="isExplainingChanges">
            <Icon :icon="isExplainingChanges ? 'lucide:loader-2' : 'lucide:zap'" :class="{ 'animate-spin': isExplainingChanges }" />
            {{ t('changes.summarize') }}
          </button>
        </div>

        <!-- AI Explanation Panel -->
        <div v-if="showAiPanel" class="absolute bottom-0 right-0 w-80 max-h-[60%] border-l border-t border-neutral-800 bg-[#252526] backdrop-blur-xl shadow-2xl flex flex-col z-40 animate-in slide-in-from-right-10 duration-300">
          <header class="p-3 border-b border-neutral-800 flex items-center justify-between bg-[#252526]">
             <div class="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                <Icon icon="lucide:sparkles" />
                Explanation
             </div>
             <button @click="showAiPanel = false" class="text-neutral-500 hover:text-white transition-colors">
               <Icon icon="lucide:x" />
             </button>
          </header>
          <SimpleBar class="flex-1 p-4 overflow-y-auto">
             <div class="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap font-mono opacity-90">
                {{ aiExplanation }}
             </div>
          </SimpleBar>
        </div>

        <div v-else-if="!selectedFile" class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8">
          <Icon icon="lucide:file-diff" class="text-5xl mb-4 opacity-10" />
          <div class="font-bold uppercase tracking-widest text-sm opacity-20">
            {{ t('changes.select_file_diff') }}
          </div>
        </div>
      </div>
       <!-- Commit Area -->
       <div class="p-3 border-t border-neutral-800 bg-[#252526] flex flex-col gap-2 flex-shrink-0">
          <div class="relative group">
            <textarea v-model="commitMessage" 
                      class="w-full h-24 bg-[#1E1E1E] border border-neutral-700 p-3 text-xs text-neutral-200 outline-none resize-none focus:border-blue-500 rounded transition-all placeholder:text-neutral-600 leading-relaxed" 
                      :placeholder="t('changes.commit_placeholder')"></textarea>
            
            <button v-if="hasAiConfig && stagedFiles.length > 0"
                    @click="handleGenerateCommit"
                    :disabled="isGeneratingCommit"
                    class="absolute bottom-3 right-3 p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-blue-400 rounded border border-neutral-700 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                    :title="t('changes.generate_commit')">
              <Icon :icon="isGeneratingCommit ? 'lucide:loader-2' : 'lucide:sparkles'" :class="{ 'animate-spin': isGeneratingCommit }" />
              {{ isGeneratingCommit ? '...' : t('changes.generate_commit') }}
            </button>
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

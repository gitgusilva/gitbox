<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import ScrollArea from '../../components/Common/ScrollArea.vue';
import { cn } from '../../utils/cn';
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
  includeUntracked,
  stashes,
  loadRepoData,
  currentBranchName
} from '../../services/gitService';
import { 
  layoutRefs
} from '../../services/layoutService';
import DiffViewer from '../../components/Common/DiffViewer.vue';
import MergeEditor from '../../components/Common/MergeEditor.vue';
import FileTree from '../../components/Common/FileTree.vue';
import Resizer from '../../components/Common/Resizer.vue';
import Tooltip from '../../components/Common/Tooltip.vue';
import { generateCommitMessage, explainChanges, isAIConfigured, aiConfigVersion } from '../../services/ai';
import { getItem, setItem } from '../../services/storageService';
import { contextMenu, requestConfirm } from '../../services/modalService';
import SubmoduleInfoView from '../../components/Common/SubmoduleInfoView.vue';
import { submodules } from '../../services/gitService';
import { useElementHover } from '@vueuse/core';
import { generalSettings } from '../../services/settingsService';
import { showToast } from '../../services/toastService';
import FileHistoryModal from '../../components/Common/FileHistoryModal.vue';
import BlameModal from '../../components/Common/BlameModal.vue';

const unstagedViewMode = ref(getItem('gitbox_unstaged_view_mode') || 'tree');
const stagedViewMode = ref(getItem('gitbox_staged_view_mode') || 'tree');

// Resizable commit panel (drag its top edge up for more room). Wrapped in an
// object so the template hands the Resizer the ref itself (not its unwrapped value).
const commitPanelHeight = ref(Number(getItem('gitbox_commit_panel_height')) || 180);
const commitRefs = { commitPanelHeight };
watch(commitPanelHeight, (h) => setItem('gitbox_commit_panel_height', String(Math.round(h))));

/**
 * Switches the view mode for the unstaged or staged file panels.
 * @param {'unstaged' | 'staged'} panel - The panel to update.
 * @param {string} mode - The view mode ('list', 'flat', 'tree').
 */
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

/**
 * Opens the view options context menu for a panel.
 * @param {MouseEvent} e - The mouse event trigger.
 * @param {'unstaged' | 'staged'} panel - The panel for which to show options.
 */
function openViewMenu(e: MouseEvent, panel: 'unstaged' | 'staged') {
  const currentMode = panel === 'unstaged' ? unstagedViewMode.value : stagedViewMode.value;
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { 
        label: t('changes_menu.view_list'), 
        icon: 'lucide:menu', 
        active: currentMode === 'list',
        action: () => setViewMode(panel, 'list') 
      },
      { 
        label: t('changes_menu.view_flat'), 
        icon: 'lucide:layout-grid', 
        active: currentMode === 'flat',
        action: () => setViewMode(panel, 'flat') 
      },
      { 
        label: t('changes_menu.view_tree'), 
        icon: 'lucide:git-branch', 
        active: currentMode === 'tree',
        action: () => setViewMode(panel, 'tree') 
      },
    ]
  };
}

/**
 * Moves selected files between staged and unstaged states.
 * @param {boolean} toStaged - True to stage files, false to unstage.
 */
async function moveSelected(toStaged: boolean) {
  if (selectedFiles.value.length === 0) return;
  const files = [...selectedFiles.value];
  for (const f of files) {
    if (toStaged) await stageFile(f);
    else await unstageFile(f);
  }
}

/**
 * Handles discarding changes for specific files or all selected files.
 * @param {string} [path] - Optional specific file path to discard.
 */
async function handleDiscard(path?: string) {
  const targets = (path ? [path] : [...selectedFiles.value]).filter(Boolean);
  if (targets.length === 0) return;
  
  const msg = targets.length === 1 
    ? t('changes.discard_msg_single', { path: targets[0] }) 
    : t('changes.discard_msg_multiple', { count: targets.length });

  requestConfirm(t('changes.discard_title'), msg + ' ' + t('changes.discard_undo_warning'), true, async () => {
    for (const f of targets) {
      await discardFile(f);
    }
  });
}

// Aborting a merge hard-resets to HEAD and drops conflict resolutions — confirm.

// --- Per-file context-menu actions -----------------------------------------
const fileHistoryTarget = ref<string | null>(null);
const blameTarget = ref<string | null>(null);

const fullPathOf = (file: string) => (repoPath.value ? `${repoPath.value}/${file}` : file);

/** Open the file with the OS default application. */
async function openFileWith() {
  if (selectedFile.value) await window.gitbox.openPath(fullPathOf(selectedFile.value));
}

/** Reveal the file in the OS file manager. */
async function revealFile() {
  if (selectedFile.value) await window.gitbox.revealInFolder(fullPathOf(selectedFile.value));
}

/** Stash only the selected file. */
async function stashSingleFile() {
  if (!repoPath.value || !selectedFile.value) return;
  try {
    await window.gitbox.stashFile(repoPath.value, selectedFile.value);
    await loadRepoData();
    showToast(t('common.success'), t('changes.stashed_file'), 'success');
  } catch (e: any) {
    showToast(t('common.error'), e?.message || String(e), 'error');
  }
}

/** Export the file's diff as a `.patch` via a native save dialog. */
async function saveFilePatch(staged: boolean) {
  if (!repoPath.value || !selectedFile.value) return;
  try {
    const result = await window.gitbox.savePatch(repoPath.value, selectedFile.value, staged);
    if (result.saved) showToast(t('common.success'), t('changes.saved_patch'), 'success');
  } catch (e: any) {
    showToast(t('common.error'), e?.message || String(e), 'error');
  }
}

/** Flip git's assume-unchanged bit for the file so local edits are ignored. */
async function toggleAssumeUnchanged() {
  if (!repoPath.value || !selectedFile.value) return;
  try {
    await window.gitbox.assumeUnchanged(repoPath.value, selectedFile.value, true);
    await loadRepoData();
    showToast(t('common.success'), t('changes.assumed_unchanged'), 'success');
  } catch (e: any) {
    showToast(t('common.error'), e?.message || String(e), 'error');
  }
}

/**
 * Opens the context menu for files in either the staged or unstaged panels.
 * @param {MouseEvent} e - The mouse event trigger.
 * @param {'unstaged' | 'staged'} panel - The panel containing the file.
 * @param {string} [path] - The path of the file clicked on.
 */
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
      { label: t('changes_menu.merge_tool'), icon: 'lucide:git-merge', shortcut: 'Ctrl+Shift+D', action: () => { if (selectedFile.value) openExternalMergeTool(selectedFile.value); } },
      { label: t('changes_menu.open_with'), icon: 'lucide:external-link', shortcut: 'Ctrl+O', action: () => openFileWith() },
      { label: t('changes_menu.reveal_explorer'), icon: 'lucide:folder-search', action: () => revealFile() },
      { type: 'separator' },
      isStaged
        ? { label: t('changes_menu.unstage'), icon: 'lucide:minus', shortcut: 'Enter/Space', action: () => moveSelected(false) }
        : { label: t('changes_menu.stage'), icon: 'lucide:plus', shortcut: 'Enter/Space', action: () => moveSelected(true) },
      !isStaged ? { label: t('changes_menu.discard'), icon: 'lucide:undo-2', shortcut: 'Back/Delete', action: () => handleDiscard(path) } : null,
      { label: t('changes_menu.stash'), icon: 'lucide:package', action: () => stashSingleFile() },
      { label: t('changes_menu.save_patch'), icon: 'lucide:file-text', action: () => saveFilePatch(isStaged) },
      !isStaged ? { label: t('changes_menu.assume_unchanged'), icon: 'lucide:eye-off', action: () => toggleAssumeUnchanged() } : null,
      isStaged ? { label: t('changes_menu.generate_commit'), icon: 'lucide:wand-2', action: () => handleGenerateCommit() } : null,
      { type: 'separator' },
      { label: t('changes_menu.history'), icon: 'lucide:history', action: () => { if (selectedFile.value) fileHistoryTarget.value = selectedFile.value; } },
      { label: t('changes_menu.blame'), icon: 'lucide:user-check', action: () => { if (selectedFile.value) blameTarget.value = selectedFile.value; } },
      { type: 'separator' },
      { label: t('changes_menu.copy_path'), icon: 'lucide:copy', shortcut: 'Ctrl+C', action: () => {
        if (selectedFile.value) navigator.clipboard.writeText(selectedFile.value);
      }},
      { label: t('changes_menu.copy_full_path'), icon: 'lucide:copy', shortcut: 'Ctrl+Shift+C', action: () => {
         if (repoPath.value && selectedFile.value) {
           const fullPath = repoPath.value + '/' + selectedFile.value;
           navigator.clipboard.writeText(fullPath);
         }
      }},
    ].filter(Boolean)
  };
}

/** Opens the native merge-conflict editor in a separate, resizable window. */
async function openMergeWindow(path: string) {
  if (!repoPath.value || !path) return;
  await window.gitbox.openMergeWindow(repoPath.value, path);
}

async function openExternalMergeTool(path: string) {
  if (!repoPath.value || !path) return false;

  const tool = generalSettings.value.externalMergeTool;
  if (!tool || tool === 'gitbox' || tool === 'none' || tool === 'custom') return false;

  try {
    await window.gitbox.openMergeTool(repoPath.value, path, tool === 'git_config_default' ? undefined : tool);
    await loadRepoData();
    await loadDiff();
    return true;
  } catch (error) {
    console.error('Failed to open external merge tool:', error);
    return false;
  }
}

/** Toggles whether to include untracked files in the status. */
function toggleUntracked() {
  includeUntracked.value = !includeUntracked.value;
  setItem('gitbox_include_untracked', includeUntracked.value ? 'true' : 'false');
}

const { t, locale } = useI18n();

const originalContent = ref('');
const modifiedContent = ref('');
const isMergeEditorRequested = ref(false);
const mergeEditorRef = ref<any>(null);
const mergeEditorState = ref({ remainingConflicts: 0, canCompleteMerge: false, isDirty: false });

/** Currently selected submodule if any. */
const selectedSubmodule = computed(() => {
  if (!selectedFile.value) return null;
  return submodules.value.find(s => s.path === selectedFile.value) || null;
});

const isSelectedFileConflicted = computed(() => {
  return !!selectedFile.value && isConflicted(selectedFile.value);
});

const isMergeEditorActive = computed(() => {
  return !!selectedFile.value && !selectedSubmodule.value && isSelectedFileConflicted.value && isMergeEditorRequested.value;
});

// --- Conflict panel (shown for a conflicted file that isn't in the merge editor) ---
const conflictCode = ref('');           // two-letter porcelain code: UU / DU / UD / …
const isResolvingConflict = ref(false);

const CONFLICT_LABELS: Record<string, string> = {
  UU: 'conflict_both_modified', AA: 'conflict_both_added', DD: 'conflict_both_deleted',
  DU: 'conflict_deleted_by_us', UD: 'conflict_deleted_by_them',
  AU: 'conflict_added_by_us', UA: 'conflict_added_by_them',
};
const conflictTypeLabel = computed(() => t(`changes.${CONFLICT_LABELS[conflictCode.value] || 'conflict_generic'}`));
// The inline merge editor only makes sense when both sides still have content.
const isContentConflict = computed(() => conflictCode.value === 'UU' || conflictCode.value === 'AA');

async function loadConflictType() {
  conflictCode.value = '';
  if (!repoPath.value || !selectedFile.value || !isSelectedFileConflicted.value) return;
  try {
    const map = await (window as any).gitbox?.conflictTypes?.(repoPath.value);
    conflictCode.value = map?.[selectedFile.value] || '';
  } catch { /* ignore */ }
}

// NOTE: the watcher that drives loadConflictType is registered AFTER
// `allChangedFiles` is declared (below), because watch() evaluates its source
// once at setup and isSelectedFileConflicted reads allChangedFiles.

/** Resolve the selected conflict by taking a whole side, then refresh. */
async function resolveConflictSide(side: 'ours' | 'theirs') {
  if (!repoPath.value || !selectedFile.value || isResolvingConflict.value) return;
  isResolvingConflict.value = true;
  try {
    await (window as any).gitbox?.resolveConflict?.(repoPath.value, selectedFile.value, side);
    await loadRepoData(true);
  } finally {
    isResolvingConflict.value = false;
  }
}

/** Current SHA for the selected submodule. */
const submoduleSha = computed(() => {
  if (!selectedFile.value || !selectedSubmodule.value) return '';
  return selectedSubmodule.value.sha || '';
});

/** Loads the diff content for the currently selected file. */
async function loadDiff() {
  if (!repoPath.value || !selectedFile.value || selectedSubmodule.value) {
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
watch(selectedFile, () => {
  isMergeEditorRequested.value = false;
});

// Clear the selection (and its now-stale diff) once the selected file is no
// longer a pending change — e.g. after it was committed or discarded — so the
// diff panel shows the empty state instead of leftover content.
watch([unstagedFiles, stagedFiles], () => {
  if (!selectedFile.value) return;
  const stillChanged = unstagedFiles.value.some(f => f.path === selectedFile.value)
    || stagedFiles.value.some(f => f.path === selectedFile.value);
  if (!stillChanged) {
    selectedFile.value = '';
    selectedFiles.value = [];
    originalContent.value = '';
    modifiedContent.value = '';
  }
});

/**
 * Handles file selection, supporting multi-select with modifier keys.
 * @param {string} path - The path of the clicked file.
 * @param {MouseEvent} [event] - The click event.
 */
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

/**
 * Handles double-click on a file, typically toggling its stage state.
 * @param {string} path - The path of the double-clicked file.
 */
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

const statusContainerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  nextTick(loadDiff);
  
  if (statusContainerRef.value) {
    const h = statusContainerRef.value.clientHeight;
    if (h > 0) {
      layoutRefs.unstagedHeight.value = Math.floor(h / 2);
    }
  }
});

/** List of all files that have changes. */
const allChangedFiles = computed(() => [...stagedFiles.value, ...unstagedFiles.value]);

/**
 * Checks if a file has merge conflicts.
 * @param {string} filePath - Path to check.
 */
function isConflicted(filePath: string) {
  const file = allChangedFiles.value.find(f => f.path === filePath);
  return file && file.status.indexOf('conflicted') !== -1;
}

// Registered here (after allChangedFiles) so the setup-time source evaluation
// doesn't hit a temporal-dead-zone on it. Refreshes the conflict kind whenever
// the selection or its conflicted state changes.
watch([selectedFile, isSelectedFileConflicted], loadConflictType, { immediate: true });

/**
 * Saves resolved merge content and stages the file.
 * @param {string} newContent - The resolved content.
 */
async function handleSaveMerge(newContent: string) {
  if (repoPath.value && selectedFile.value) {
    try {
      await window.gitbox.saveFile(repoPath.value, selectedFile.value, newContent);
      await loadDiff();
    } catch (err) {
      console.error('Failed to save merge resolution:', err);
    }
  }
}

async function handleCompleteMerge(newContent: string) {
  if (repoPath.value && selectedFile.value) {
    try {
      await window.gitbox.saveFile(repoPath.value, selectedFile.value, newContent);
      await window.gitbox.stageFile(repoPath.value, selectedFile.value);
      await loadRepoData();
      await loadDiff();
    } catch (err) {
      console.error('Failed to complete merge resolution:', err);
    }
  }
}

function handleMergeEditorState(state: { remainingConflicts: number; canCompleteMerge: boolean; isDirty: boolean }) {
  mergeEditorState.value = state;
}

const isGeneratingCommit = ref(false);
const isExplainingChanges = ref(false);
const aiExplanation = ref('');
const showAiPanel = ref(false);

/** Whether AI features are configured (an API key, or a selected local CLI).
 *  Depends on aiConfigVersion so it re-evaluates when the user changes provider. */
const hasAiConfig = computed(() => (aiConfigVersion.value, isAIConfigured()));

// --- SourceGit-style split commit message: subject line + description body ---
const commitSubject = ref('');
const commitDescription = ref('');
let syncingCommit = false;

// Seed the two fields from any existing message (restored / pre-filled).
{
  const v = commitMessage.value || '';
  const nl = v.indexOf('\n');
  commitSubject.value = nl === -1 ? v : v.slice(0, nl);
  commitDescription.value = nl === -1 ? '' : v.slice(nl + 1).replace(/^\n/, '');
}

// subject + description -> the actual commit message that gets committed.
watch([commitSubject, commitDescription], () => {
  syncingCommit = true;
  const body = commitDescription.value.trim();
  commitMessage.value = commitSubject.value + (body ? '\n\n' + body : '');
  syncingCommit = false;
});

// External changes (e.g. cleared after a successful commit) -> re-split the fields.
watch(commitMessage, (val) => {
  if (syncingCommit) return;
  const v = val || '';
  const nl = v.indexOf('\n');
  commitSubject.value = nl === -1 ? v : v.slice(0, nl);
  commitDescription.value = nl === -1 ? '' : v.slice(nl + 1).replace(/^\n/, '');
});

// Git convention: subject reads best <= 50 chars; 72 is the usual hard guide.
const subjectLenClass = computed(() => {
  const n = commitSubject.value.length;
  if (n > 72) return 'text-red-500';
  if (n > 50) return 'text-amber-500';
  return 'text-neutral-500';
});

/** Triggers AI commit message generation based on staged changes. */
async function handleGenerateCommit() {
  if (!repoPath.value || stagedFiles.value.length === 0) return;
  
  isGeneratingCommit.value = true;
  try {
    const diff = await window.gitbox.getStagedDiff(repoPath.value);
    const result = await generateCommitMessage(diff, locale.value);
    if (result.text) {
      // Split the generated message into subject (line 1) + description (rest).
      const text = result.text.trim();
      const nl = text.indexOf('\n');
      commitSubject.value = nl === -1 ? text : text.slice(0, nl).trim();
      commitDescription.value = nl === -1 ? '' : text.slice(nl + 1).replace(/^\s+/, '');
    } else if (result.error) {
      alert(result.error);
    }
  } finally {
    isGeneratingCommit.value = false;
  }
}

/** Triggers AI explanation for the currently selected file's changes. */
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
      aiExplanation.value = result.error.indexOf('Quota') !== -1 || result.error.indexOf('Cota') !== -1 ? result.error : `Error: ${result.error}`;
    }
  } finally {
    isExplainingChanges.value = false;
  }
}
</script>

<template>
  <div :class="cn('flex-1 flex flex-col min-h-0 min-w-0 bg-app')">
    <div :class="cn('flex-1 flex flex-row items-stretch min-h-0 min-w-0')">
    <!-- Status Sidebar -->
    <div ref="statusContainerRef" :class="cn(
      'v-stack border-r border-line bg-app shrink-0 relative select-none h-full min-h-0 transition-none',
      'contain-size layout paint'
    )" :style="{ 
      width: `var(--layout-status-width, ${layoutRefs.statusWidth.value}px)`, 
      willChange: 'width' 
    }">
       <Resizer :target="(layoutRefs.statusWidth as any)" :options="{ min: 150, max: 800, cssVar: '--layout-status-width' }" class="absolute right-0 top-0 bottom-0" />
       
       <!-- Unstaged -->
       <header :class="cn('bg-neutral-200/50 dark:bg-neutral-800/50 border-b border-line px-3 py-2 text-[10px] font-bold text-content-muted h-stack justify-between uppercase tracking-widest items-center')">
         <div :class="cn('h-stack items-center gap-2 min-w-0 flex-1')">
           <Icon icon="lucide:file-warning" class="text-neutral-500 shrink-0" />
           <span class="truncate">{{ t('changes.unstaged') }} ({{ unstagedFiles.length }})</span>
         </div>
         <div :class="cn('h-stack items-center gap-1 shrink-0')">
           <Tooltip :text="t('changes.include_untracked')">
             <button @click="toggleUntracked" :class="cn('w-6 h-6 center transition-colors', includeUntracked ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white')">
               <Icon :icon="includeUntracked ? 'lucide:eye' : 'lucide:eye-off'" class="text-xs" />
             </button>
           </Tooltip>
           <Tooltip :text="t('changes.view_options')">
             <button @click="openViewMenu($event, 'unstaged')" :class="cn('w-6 h-6 center hover:text-neutral-900 dark:hover:text-white transition-colors')">
               <Icon icon="lucide:layout-grid" class="text-xs" />
             </button>
           </Tooltip>
           <Tooltip :text="t('changes.stage_selected')">
             <button @click="moveSelected(true)" :disabled="selectedFiles.length === 0" :class="cn('w-6 h-6 center hover:text-blue-400 disabled:opacity-30 transition-colors')">
               <Icon icon="lucide:chevron-down" class="text-sm" />
             </button>
           </Tooltip>
           <Tooltip :text="t('changes.stage_all')">
             <button @click="stageAll" :class="cn('w-6 h-6 center hover:text-green-400 transition-colors')">
               <Icon icon="lucide:chevrons-down" class="text-sm" />
             </button>
           </Tooltip>
         </div>
       </header>
       
       <div :class="cn('relative v-stack shrink-0')" 
            :style="{ 
              height: `var(--layout-unstaged-height, ${layoutRefs.unstagedHeight.value}px)`,
              willChange: 'height'
            }">
         <div :class="cn('h-full bg-neutral-100/20 dark:bg-neutral-900/20 border-b border-neutral-200/20 dark:border-neutral-800/20 shadow-inner overflow-hidden')" @contextmenu.prevent="(e: MouseEvent) => openContextMenu(e, 'unstaged')">
            <FileTree :files="unstagedFiles" :viewMode="unstagedViewMode" :selectedPath="selectedFile" :selectedPaths="selectedFiles" 
                       @select="handleSelect" @dblclick="handleDblClick" @contextmenu="(p: string, e: MouseEvent) => openContextMenu(e, 'unstaged', p)" />
         </div>
         <Resizer vertical :target="(layoutRefs.unstagedHeight as any)" :options="{ axis: 'y', min: 100, max: 800, cssVar: '--layout-unstaged-height' }" class="absolute bottom-0 left-0 right-0 h-1.5 z-30" />
       </div>
       
       <!-- Staged -->
       <header :class="cn('bg-neutral-200/50 dark:bg-neutral-800/50 border-b border-t border-line px-3 py-2 text-[10px] font-bold text-content-muted h-stack justify-between uppercase tracking-widest items-center')">
         <div :class="cn('h-stack items-center gap-2 min-w-0 flex-1')">
           <Icon icon="lucide:check-circle-2" class="text-neutral-500 shrink-0" />
           <span class="truncate">{{ t('changes.staged') }} ({{ stagedFiles.length }})</span>
         </div>
         <div :class="cn('h-stack items-center gap-1 shrink-0')">
           <Tooltip :text="t('changes.view_options')">
             <button @click="openViewMenu($event, 'staged')" :class="cn('w-6 h-6 center hover:text-neutral-900 dark:hover:text-white transition-colors')">
               <Icon icon="lucide:layout-grid" class="text-xs" />
             </button>
           </Tooltip>
           <Tooltip :text="t('changes.unstage_selected')">
             <button @click="moveSelected(false)" :disabled="selectedFiles.length === 0" :class="cn('w-6 h-6 center hover:text-blue-400 disabled:opacity-30 transition-colors')">
               <Icon icon="lucide:chevron-up" class="text-sm" />
             </button>
           </Tooltip>
           <Tooltip :text="t('changes.unstage_all')">
             <button @click="unstageAll" :class="cn('w-6 h-6 center hover:text-red-400 transition-colors')">
               <Icon icon="lucide:chevrons-up" class="text-sm" />
             </button>
           </Tooltip>
         </div>
       </header>
       
        <div :class="cn('flex-1 bg-neutral-100/20 dark:bg-neutral-900/20 min-h-0 shadow-inner overflow-hidden')" @contextmenu.prevent="(e: MouseEvent) => openContextMenu(e, 'staged')">
           <FileTree :files="stagedFiles" :viewMode="stagedViewMode" :selectedPath="selectedFile" :selectedPaths="selectedFiles" 
                     @select="handleSelect" @dblclick="handleDblClick" @contextmenu="(p: string, e: MouseEvent) => openContextMenu(e, 'staged', p)" />
        </div>
    </div>

    <!-- Editor / Diff Viewer -->
    <div :class="cn('flex-1 v-stack bg-app relative min-w-0')">
      <div :class="cn('flex-1 v-stack min-h-0 relative min-w-0')">
        <template v-if="selectedFile">
            <template v-if="selectedSubmodule">
               <div :class="cn('flex-1 v-stack overflow-hidden min-h-0 relative')">
                  <DiffViewer :original="originalContent" :modified="modifiedContent" :filename="selectedFile" :readOnly="true" class="flex-1" />
                  <Resizer vertical :target="layoutRefs.submoduleDetailHeight" :options="{ axis: 'y', invert: true, min: 100, max: 800 }" class="absolute bottom-0 left-0 right-0 h-1.5 z-30" />
               </div>
               
               <div :style="{ height: layoutRefs.submoduleDetailHeight.value + 'px' }" :class="cn('shrink-0 border-t border-line bg-app relative')">
                  <SubmoduleInfoView :path="selectedFile" :sha="submoduleSha" />
               </div>
            </template>
            <template v-else>
              <!-- Conflict panel: what to do with an unmerged file. The merge
                   editor always opens in a separate window, never inline here. -->
              <div v-if="isSelectedFileConflicted"
                   :class="cn('flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center bg-app')">
                <div class="w-16 h-16 rounded-2xl bg-removed/10 border border-removed/30 center">
                  <Icon icon="lucide:git-merge" class="text-3xl text-removed" />
                </div>
                <div>
                  <div class="text-sm font-bold uppercase tracking-widest text-content-strong">{{ t('changes.conflicts_detected') }}</div>
                  <div class="text-xs text-content-muted mt-1">{{ conflictTypeLabel }}</div>
                </div>
                <div class="text-[11px] text-content-muted flex flex-col gap-1.5 items-center">
                  <div class="h-stack items-center gap-2">
                    <span class="uppercase font-bold tracking-wider text-modified">{{ t('changes.current') }}</span>
                    <Icon icon="lucide:git-branch" class="w-3 h-3" />
                    <span class="text-content font-mono truncate max-w-[240px]">{{ currentBranchName || '-' }}</span>
                  </div>
                  <div class="h-stack items-center gap-2">
                    <span class="uppercase font-bold tracking-wider text-added">{{ t('changes.incoming') }}</span>
                    <Icon icon="lucide:git-merge" class="w-3 h-3" />
                    <span class="text-content">{{ t('changes.incoming_changes') }}</span>
                  </div>
                </div>
                <div class="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <button v-if="isContentConflict" @click="openMergeWindow(selectedFile)"
                          class="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent hover:bg-accent-hover text-accent-fg transition-colors h-stack items-center gap-1.5">
                    <Icon icon="lucide:git-merge" class="w-3.5 h-3.5" /> {{ t('changes.open_merge_editor') }}
                  </button>
                  <button @click="resolveConflictSide('ours')" :disabled="isResolvingConflict"
                          class="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-modified/50 text-modified hover:bg-modified/10 disabled:opacity-50 transition-colors">
                    {{ t('changes.use_current') }}
                  </button>
                  <button @click="resolveConflictSide('theirs')" :disabled="isResolvingConflict"
                          class="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-added/50 text-added hover:bg-added/10 disabled:opacity-50 transition-colors">
                    {{ t('changes.use_incoming') }}
                  </button>
                  <button @click="openExternalMergeTool(selectedFile)"
                          class="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-line-strong text-content-muted hover:text-content hover:bg-surface-hover transition-colors">
                    {{ t('changes.open_external_mergetool') }}
                  </button>
                </div>
              </div>

              <DiffViewer v-else
                          :original="originalContent"
                          :modified="modifiedContent"
                          :filename="selectedFile"
                          :readOnly="true" />
            </template>
        </template>
        <div v-else :class="cn('flex-1 center v-stack text-neutral-600 pointer-events-none text-center p-8')">
          <Icon icon="lucide:file-diff" :class="cn('text-5xl mb-4 opacity-10')" />
          <div :class="cn('font-bold uppercase tracking-widest text-sm opacity-20')">{{ t('changes.select_file_diff') }}</div>
        </div>
        
        <!-- AI Explanation Panel -->
        <div v-if="showAiPanel" :class="cn('absolute bottom-0 right-0 w-80 max-h-[60%] border-l border-t border-line bg-neutral-100/90 dark:bg-neutral-900/90 backdrop-blur-xl shadow-2xl v-stack z-40 animate-in slide-in-from-right-10 duration-300')">
          <header :class="cn('p-3 border-b border-line h-stack items-center justify-between')">
             <div :class="cn('h-stack items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest')">
                <Icon icon="lucide:sparkles" />
                <span>Explanation</span>
             </div>
             <button @click="showAiPanel = false" :class="cn('text-neutral-500 hover:text-neutral-900 dark:hover:text-white center transition-colors')">
               <Icon icon="lucide:x" />
             </button>
          </header>
          <ScrollArea :class="cn('flex-1 p-4')">
             <div :class="cn('text-xs text-content leading-relaxed whitespace-pre-wrap font-mono opacity-90')">
                {{ aiExplanation }}
             </div>
          </ScrollArea>
        </div>

        <div v-if="!selectedFile" :class="cn('flex-1 center v-stack text-neutral-600 pointer-events-none text-center p-8')">
          <Icon icon="lucide:file-diff" :class="cn('text-5xl mb-4 opacity-10')" />
          <div :class="cn('font-bold uppercase tracking-widest text-sm opacity-20')">
            {{ t('changes.select_file_diff') }}
          </div>
        </div>
      </div>

       <!-- Commit Area (resizable — drag the top edge up) -->
       <div v-if="!isMergeEditorActive"
            :class="cn('p-3 border-t border-line bg-surface v-stack gap-2 shrink-0 relative')"
            :style="{ height: commitPanelHeight + 'px' }">
          <Resizer vertical :target="commitRefs.commitPanelHeight"
                   :options="{ axis: 'y', invert: true, min: 150, max: 700, clampToContainer: true, reserve: 160 }"
                   class="absolute top-0 left-0 right-0 h-1.5 -translate-y-1/2 z-40" />
          <!-- Toolbar: label + AI generate -->
          <div class="flex items-center justify-between h-5">
            <span class="text-[10px] font-bold uppercase tracking-widest text-content-muted">{{ t('changes.commit_message_label') }}</span>
            <Tooltip v-if="hasAiConfig" :text="stagedFiles.length === 0 ? t('changes.stage_to_generate') : t('changes.generate_commit')" position="top">
              <button @click="handleGenerateCommit"
                      :disabled="isGeneratingCommit || stagedFiles.length === 0"
                      :class="cn(
                        'h-7 w-7 flex items-center justify-center rounded transition-all',
                        'bg-blue-600 hover:bg-blue-500 text-white shadow-sm',
                        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600'
                      )">
                <Icon :icon="isGeneratingCommit ? 'lucide:loader-2' : 'lucide:sparkles'" :class="cn('text-sm', isGeneratingCommit ? 'animate-spin' : '')" />
              </button>
            </Tooltip>
          </div>

          <!-- Subject line (SourceGit-style) with a live length hint (50 / 72). -->
          <div :class="cn('relative')">
            <input v-model="commitSubject"
                   type="text"
                   :placeholder="t('changes.commit_subject_placeholder')"
                   :class="cn(
                     'w-full bg-surface border border-line-strong px-3 py-2 pr-14 text-xs font-medium text-content outline-none focus:border-accent rounded transition-all placeholder:text-content-muted placeholder:font-normal'
                   )" />
            <span v-if="commitSubject.length > 0"
                  :class="cn('absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono tabular-nums pointer-events-none', subjectLenClass)">
              {{ commitSubject.length }}
            </span>
          </div>

          <!-- Description body -->
          <textarea v-model="commitDescription"
                    :class="cn(
                      'w-full flex-1 min-h-0 bg-surface border border-line-strong p-3 text-xs text-content outline-none resize-none focus:border-accent rounded transition-all placeholder:text-content-muted leading-relaxed'
                    )"
                    :placeholder="t('changes.commit_desc_placeholder')"></textarea>
         <button @click="commitAll"
                 :class="cn(
                   'bg-blue-600 hover:bg-blue-500 text-white py-2 text-xs font-bold rounded transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-blue-900/20 active:scale-[0.98] center h-stack gap-2 uppercase tracking-widest'
                 )"
                 :disabled="!commitSubject.trim() || stagedFiles.length === 0">
           <Icon icon="lucide:git-commit" />
           <span>{{ t('changes.commit') }}</span>
         </button>
       </div>
    </div>
    </div>

    <FileHistoryModal
      v-if="fileHistoryTarget"
      :repo-path="repoPath"
      :file="fileHistoryTarget"
      @close="fileHistoryTarget = null" />
    <BlameModal
      v-if="blameTarget"
      :repo-path="repoPath"
      :file="blameTarget"
      @close="blameTarget = null" />
  </div>
</template>

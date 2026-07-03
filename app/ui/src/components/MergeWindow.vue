<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../services/themeService';
import MergeEditor from './Common/MergeEditor.vue';

const { t } = useI18n();
const { currentTheme, applyTheme } = useTheme();

const params = new URLSearchParams(window.location.search);
const repoPath = params.get('repo') || '';
const filePath = ref(params.get('file') || '');

const original = ref('');
const modified = ref('');
const loaded = ref(false);
const loadError = ref('');
const isSaving = ref(false);
const mergeEditorRef = ref<any>(null);
const mergeState = ref({ remainingConflicts: 0, canCompleteMerge: false, isDirty: false });

const fileName = computed(() => filePath.value.split('/').pop() || filePath.value);

// After resolving a file, offer to continue with the next conflicted file.
const showNextPrompt = ref(false);
const remainingConflicts = ref<string[]>([]);
const justResolvedFile = ref('');
const mergeTool = ref<{ value: string; label: string } | null>(null);
const nextFile = computed(() => remainingConflicts.value[0] || '');

async function detectMergeTool() {
  try {
    const tools = await window.gitbox.detectExternalTools();
    if (tools?.mergeTools?.length) mergeTool.value = tools.mergeTools[0];
  } catch { /* ignore */ }
}

async function fetchRemainingConflicts(): Promise<string[]> {
  try {
    const st = await window.gitbox.status(repoPath);
    return (st || [])
      .filter((e: any) => String(e.status || '').includes('conflict'))
      .map((e: any) => e.path)
      .filter((p: string) => p && p !== filePath.value);
  } catch {
    return [];
  }
}

async function loadDiff() {
  loaded.value = false;
  loadError.value = '';
  if (!repoPath || !filePath.value) {
    loadError.value = t('changes.select_file_diff');
    loaded.value = true;
    return;
  }
  try {
    const diff = await window.gitbox.diffFile(repoPath, filePath.value);
    original.value = diff.original ?? '';
    modified.value = diff.modified ?? '';
  } catch (err: any) {
    loadError.value = err?.message || String(err);
  } finally {
    loaded.value = true;
  }
}

async function handleSave(newContent: string) {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await window.gitbox.saveFile(repoPath, filePath.value, newContent);
  } catch (err) {
    console.error('Failed to save merge resolution:', err);
  } finally {
    isSaving.value = false;
  }
}

async function handleComplete(newContent: string) {
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    await window.gitbox.saveFile(repoPath, filePath.value, newContent);
    await window.gitbox.stageFile(repoPath, filePath.value);
    justResolvedFile.value = filePath.value;

    // Any other files still in conflict? If so, ask what to do next instead of
    // just closing the window.
    remainingConflicts.value = await fetchRemainingConflicts();
    if (remainingConflicts.value.length > 0) {
      showNextPrompt.value = true;
      isSaving.value = false;
    } else {
      // All resolved → refresh the main window and close this one.
      window.gitbox.notifyMergeResolved();
    }
  } catch (err) {
    console.error('Failed to complete merge resolution:', err);
    isSaving.value = false;
  }
}

// Load the next conflicted file into this same window.
async function continueWithNext() {
  const next = nextFile.value;
  showNextPrompt.value = false;
  if (!next) { window.gitbox.notifyMergeResolved(); return; }
  filePath.value = next;
  document.title = `GitBox — ${t('changes.merging')}: ${fileName.value}`;
  await loadDiff();
}

// Open the next conflicted file in the external merge tool, then continue here too.
async function openNextInExternal() {
  const next = nextFile.value;
  if (!next) return;
  try {
    await window.gitbox.openMergeTool(repoPath, next, mergeTool.value?.value);
  } catch (e) {
    console.error('Failed to open external merge tool:', e);
  }
  await continueWithNext();
}

// Stop here — refresh the main window and close (remaining conflicts stay).
function finishMergeSession() {
  showNextPrompt.value = false;
  window.gitbox.notifyMergeResolved();
}

function handleState(state: { remainingConflicts: number; canCompleteMerge: boolean; isDirty: boolean }) {
  mergeState.value = state;
}

const minimizeWindow = () => window.gitbox.minimize();
const maximizeWindow = () => window.gitbox.maximize();
const closeWindow = () => window.gitbox.close();

onMounted(() => {
  applyTheme(currentTheme.value);
  document.title = `GitBox — ${t('changes.merging')}: ${fileName.value}`;
  detectMergeTool();
  loadDiff();
});
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-app text-content overflow-hidden">
    <!-- Title bar (draggable) -->
    <div
      class="h-9 shrink-0 flex items-center justify-between px-3 bg-surface border-b border-line select-none"
      style="-webkit-app-region: drag;"
    >
      <div class="flex items-center gap-2 min-w-0 text-[11px] font-bold uppercase tracking-widest text-content">
        <Icon icon="lucide:git-merge" class="text-amber-500 text-sm" />
        <span class="truncate">{{ t('changes.merging') }}: {{ fileName }}</span>
      </div>

      <div class="flex items-center gap-1" style="-webkit-app-region: no-drag;">
        <button @click="minimizeWindow" class="w-9 h-7 center text-content-muted hover:bg-surface-hover hover:text-content-strong rounded transition-colors">
          <Icon icon="lucide:minus" class="text-sm" />
        </button>
        <button @click="maximizeWindow" class="w-9 h-7 center text-content-muted hover:bg-surface-hover hover:text-content-strong rounded transition-colors">
          <Icon icon="lucide:square" class="text-[11px]" />
        </button>
        <button @click="closeWindow" class="w-9 h-7 center text-content-muted hover:bg-red-600 hover:text-white rounded transition-colors">
          <Icon icon="lucide:x" class="text-sm" />
        </button>
      </div>
    </div>

    <!-- Editor -->
    <div class="flex-1 min-h-0 flex flex-col relative">
      <template v-if="loaded && !loadError">
        <MergeEditor
          ref="mergeEditorRef"
          :original="original"
          :modified="modified"
          :filename="filePath"
          :repoPath="repoPath"
          @save="handleSave"
          @complete="handleComplete"
          @state="handleState"
        />

        <!-- Floating complete-merge action -->
        <div class="absolute bottom-3 right-5 h-stack gap-2 z-30">
          <button
            @click="mergeEditorRef?.completeMerge?.()"
            :disabled="!mergeState.canCompleteMerge || isSaving"
            :class="[
              'h-stack items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all shadow-xl',
              mergeState.canCompleteMerge && !isSaving
                ? 'bg-accent hover:bg-accent-hover border border-accent/40 text-accent-fg'
                : 'bg-surface border border-line-strong text-content-muted cursor-not-allowed',
            ]"
          >
            <Icon :icon="isSaving ? 'lucide:loader-2' : 'lucide:check'" :class="isSaving ? 'animate-spin' : ''" />
            {{ t('changes.complete_merge') }}
          </button>
        </div>
      </template>

      <div v-else-if="loaded && loadError" class="flex-1 center v-stack text-content-muted text-center p-8">
        <Icon icon="lucide:alert-triangle" class="text-4xl mb-3 opacity-30" />
        <div class="text-xs max-w-md break-words">{{ loadError }}</div>
      </div>

      <div v-else class="flex-1 center text-content-muted">
        <Icon icon="lucide:loader-2" class="text-2xl animate-spin" />
      </div>
    </div>

    <!-- After resolving a file: continue with the next conflict, open it in the
         external merge tool, or finish. -->
    <div v-if="showNextPrompt" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="w-[460px] max-w-[92vw] bg-surface border border-line rounded-xl shadow-2xl overflow-hidden">
        <div class="p-5 v-stack gap-3">
          <div class="flex items-center gap-2 text-emerald-500">
            <Icon icon="lucide:check-circle-2" class="text-lg" />
            <span class="text-sm font-bold">{{ t('changes.merge_resolved_title') }}</span>
          </div>
          <p class="text-xs text-content-muted break-words">{{ t('changes.merge_resolved_msg', { file: justResolvedFile }) }}</p>

          <div class="border-t border-line pt-3 v-stack gap-1.5">
            <p class="text-xs font-medium text-content">{{ t('changes.next_conflict_prompt') }}</p>
            <p class="text-[11px] text-accent font-mono truncate" :title="nextFile">{{ t('changes.next_file', { file: nextFile }) }}</p>
            <p class="text-[10px] text-amber-500">{{ t('changes.remaining_conflicts_count', { count: remainingConflicts.length }) }}</p>
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 px-5 py-3 bg-app border-t border-line">
          <button @click="finishMergeSession"
                  class="px-3 py-1.5 rounded text-xs font-bold text-content hover:bg-surface-hover transition-colors">
            {{ t('changes.finish_merge_session') }}
          </button>
          <button v-if="mergeTool" @click="openNextInExternal"
                  class="px-3 py-1.5 rounded text-xs font-bold text-content border border-line-strong hover:bg-surface-hover transition-colors flex items-center gap-1.5">
            <Icon icon="lucide:external-link" class="text-xs" />
            {{ t('changes.open_in_external', { tool: mergeTool.label }) }}
          </button>
          <button @click="continueWithNext"
                  class="px-4 py-1.5 rounded text-xs font-bold bg-accent hover:bg-accent-hover text-accent-fg transition-colors flex items-center gap-1.5">
            <Icon icon="lucide:arrow-right" class="text-xs" />
            {{ t('changes.continue_here') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

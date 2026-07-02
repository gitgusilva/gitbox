<script setup lang="ts">
import { ref, watch, shallowRef, onMounted, onUnmounted, computed, triggerRef, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';
import { 
  log, 
  selectedCommit, 
  selectedCommits,
  selectedLogRef, 
  loadRepoData,
  loadMoreLog,
  isLoadingData,
  repoPath,
  branches,
  tags
} from '../../services/gitService';
import { 
  historyAuthorWidth, 
  historyDateWidth, 
  detailsWidth,
  layoutRefs
} from '../../services/layoutService';
import { appendCommitGraph, createGraphState, GraphState } from '../../GraphBuilder';
import { GraphNode, Commit } from '../../types/git';
import { generalSettings } from '../../services/settingsService';
import { contextMenu, requestConfirm, requestInput } from '../../services/modalService';
import { showToast } from '../../services/toastService';

// Components
import HistoryCommitList from './components/HistoryCommitList.vue';
import HistoryDetailPanel from './components/HistoryDetailPanel.vue';
import Modal from '../../components/Common/Modal.vue';
import { Icon } from '@iconify/vue';
import { explainChanges } from '../../services/ai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const { t, locale } = useI18n();

// --- AI commit analysis modal ---
const aiModalOpen = ref(false);
const aiExplanation = ref('');
const aiLoading = ref(false);
// Paths of the files touched by the explained commit(s) — used to turn file /
// namespace mentions in the AI output into clickable links.
const aiCommitFiles = ref<string[]>([]);
// Set transiently to ask HistoryDetailPanel to switch tabs (e.g. to "changes").
const detailRequestedTab = ref('');

function normalizeRef(s: string): string {
    return s.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^`|`$/g, '');
}

/** Resolve a code-span / namespace mention to an actual changed file path. */
function resolveAiPath(raw: string): string | null {
    const text = normalizeRef(raw);
    if (!text || text.length < 2) return null;
    const files = aiCommitFiles.value;
    if (files.includes(text)) return text;
    let m = files.find(f => f === text || f.endsWith('/' + text));
    if (m) return m;
    // Namespace-ish (App\Foo\Bar) or path without extension.
    const noExt = text.replace(/\.[a-z0-9]+$/i, '');
    m = files.find(f => {
        const fn = f.replace(/\.[a-z0-9]+$/i, '');
        return fn === noExt || fn.endsWith('/' + noExt);
    });
    if (m) return m;
    // Unique basename match.
    const base = text.split('/').pop() || text;
    const baseMatches = files.filter(f => (f.split('/').pop() || '') === base);
    return baseMatches.length === 1 ? baseMatches[0] : null;
}

const HTML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function decodeEntities(s: string): string {
    return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (e) => HTML_ENTITIES[e] || e);
}

/** Tag <code> spans that name a changed file so they render as clickable links. */
function decorateFileRefs(html: string): string {
    return html.replace(/<code>([^<]+)<\/code>/g, (full, inner) => {
        const path = resolveAiPath(decodeEntities(inner));
        if (!path) return full;
        return `<code class="ai-fileref" data-path="${path.replace(/"/g, '&quot;')}">${inner}</code>`;
    });
}

const renderedAiExplanation = computed(() => {
    try {
        const html = DOMPurify.sanitize(marked.parse(aiExplanation.value || '') as string);
        return decorateFileRefs(html);
    } catch {
        return aiExplanation.value;
    }
});

/** Click on a decorated file link → close the modal and focus that file in the tree. */
function onAiExplanationClick(e: MouseEvent) {
    const el = (e.target as HTMLElement)?.closest?.('.ai-fileref') as HTMLElement | null;
    if (!el) return;
    const path = el.getAttribute('data-path');
    if (!path) return;
    aiModalOpen.value = false;
    selectedCommitFile.value = path;
    detailRequestedTab.value = 'changes';
    nextTick(() => { detailRequestedTab.value = ''; });
}
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
const commitListRef = ref<any>(null);

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

function selectCommit(c: Commit, event: MouseEvent) {
    if (event.ctrlKey || event.metaKey) {
        const idx = selectedCommits.value.findIndex(sc => sc.id === c.id);
        if (idx !== -1) {
            selectedCommits.value = selectedCommits.value.filter(sc => sc.id !== c.id);
        } else {
            selectedCommits.value = [...selectedCommits.value, c];
        }
    } else if (event.shiftKey && selectedCommits.value.length > 0) {
        const lastSelected = selectedCommits.value[selectedCommits.value.length - 1];
        const idx1 = log.value.findIndex(l => l.id === lastSelected.id);
        const idx2 = log.value.findIndex(l => l.id === c.id);
        if (idx1 !== -1 && idx2 !== -1) {
            const start = Math.min(idx1, idx2);
            const end = Math.max(idx1, idx2);
            const range = log.value.slice(start, end + 1);
            const newSelection = [...selectedCommits.value];
            for (const r of range) {
                if (!newSelection.some(sc => sc.id === r.id)) {
                    newSelection.push(r);
                }
            }
            selectedCommits.value = newSelection;
        }
    } else {
        selectedCommits.value = [c];
    }
}

async function handleExplainCommits() {
    if (!selectedCommits.value.length || !repoPath.value) return;
    aiModalOpen.value = true;
    aiLoading.value = true;
    aiExplanation.value = '';
    aiCommitFiles.value = [];
    try {
        // Gather the full patch of each selected commit (capped) as context, plus
        // the list of changed files so we can link file mentions in the output.
        const parts: string[] = [];
        const files = new Set<string>();
        for (const c of selectedCommits.value.slice(0, 5)) {
            const patch = await window.gitbox.commitDiff(repoPath.value, c.id);
            if (patch) parts.push(patch);
            try {
                const cf = await window.gitbox.commitFiles(repoPath.value, c.id);
                cf.forEach((f: any) => f?.path && files.add(f.path));
            } catch { /* ignore */ }
        }
        aiCommitFiles.value = Array.from(files);
        if (!parts.length) { aiExplanation.value = t('history_detail.ai_no_diff'); return; }
        const result = await explainChanges(parts.join('\n\n'), locale.value);
        aiExplanation.value = result.text || result.error || t('history_detail.ai_no_response');
    } catch (e: any) {
        aiExplanation.value = String(e?.message || e);
    } finally {
        aiLoading.value = false;
    }
}

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

let graphState: GraphState = createGraphState();

watch(log, (newLog, oldLog) => {
  if (!newLog) {
      graphOutput.value = new Map();
      graphState = createGraphState();
      return;
  }

  // Appended page during infinite scroll (same top commit, longer list): lay out
  // ONLY the new commits and extend the existing graph — no full O(n) rebuild.
  const isAppend = oldLog && oldLog.length > 0 && newLog.length > oldLog.length
      && newLog[0]?.id === oldLog[0]?.id;

  if (isAppend) {
      appendCommitGraph(graphOutput.value, graphState, newLog.slice(oldLog.length));
      triggerRef(graphOutput);
  } else {
      // Fresh log (repo/ref switch or first load) → rebuild from scratch.
      graphState = createGraphState();
      const map = new Map<string, GraphNode>();
      appendCommitGraph(map, graphState, newLog);
      graphOutput.value = map;
      // Jump to top only on a genuine reset (top commit changed / first load).
      if (!oldLog || oldLog.length === 0 || newLog[0]?.id !== oldLog[0]?.id) {
          setTimeout(() => commitListRef.value?.scrollToTop(), 50);
      }
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

async function gitAction(fn: () => Promise<unknown>, successMsg: string) {
  try {
    await fn();
    await loadRepoData(true);
    showToast(t('history_detail.toast_ok'), successMsg, 'success');
  } catch (e: any) {
    showToast(t('history_detail.toast_error'), e.message, 'error');
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!selectedCommit.value || log.value.length === 0) return;
      const idx = log.value.findIndex(c => c.id === selectedCommit.value!.id);
      if (idx === -1) return;
      
      e.preventDefault();
      let nextIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < log.value.length) {
          selectedCommit.value = log.value[nextIdx];
          setTimeout(() => commitListRef.value?.scrollToCommit(selectedCommit.value!.id), 0);
      }
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));

const navigateToCommit = async (p: any) => {
    if (!p || !p.id) return;
    const found = log.value.find(c => c.id === p.id);
    if (found) {
        selectedCommit.value = found;
        setTimeout(() => commitListRef.value?.scrollToCommit(p.id), 50);
        return;
    }

    try {
        const singleLog = await window.gitbox.log(repoPath.value, 1, p.id);
        if (singleLog && singleLog.length > 0) {
            selectedCommit.value = singleLog[0];
            return;
        }
    } catch (e) {
        console.error('Failed to fetch commit details:', e);
    }
    selectedCommit.value = p;
};

// --- Context Menu Actions ---

async function createBranchFromCommit(sha: string) {
  requestInput(t('history_menu.create_branch'), t('history_menu.branch_name_placeholder'), '', '', 'OK', async (name: string) => {
    if (name) {
      await gitAction(() => window.gitbox.createBranch(repoPath.value, name, sha), t('history_detail.branch_created', { name }));
    }
  });
}

async function createTagFromCommit(sha: string) {
  requestInput(t('history_menu.create_tag'), t('history_menu.tag_name_placeholder'), '', '', 'OK', async (name: string) => {
    if (name) {
      await gitAction(() => window.gitbox.createTag(repoPath.value, name, sha), t('history_detail.tag_created', { name }));
    }
  });
}

async function rewordCommitAction(sha: string, oldMsg: string) {
  requestInput(t('history_menu.reword'), t('history_menu.new_message_placeholder'), '', oldMsg, 'OK', async (newMsg: string) => {
    if (newMsg && newMsg !== oldMsg) {
       showToast(t('history_detail.toast_wip'), t('history_detail.reword_pending'), 'info');
    }
  });
}

async function squashCommitAction(sha: string) {
  requestConfirm(t('history_menu.squash'), t('history_detail.squash_confirm'), true, async () => {
    showToast(t('history_detail.toast_wip'), t('history_detail.squash_pending'), 'info');
  });
}

async function revertCommitAction(sha: string, summary: string) {
  requestConfirm(t('history_menu.revert'), t('history_detail.revert_confirm', { summary }), true, async () => {
    await gitAction(() => window.gitbox.revertCommit(repoPath.value, sha), t('history_detail.commit_reverted', { sha: sha.substring(0,7) }));
  });
}

function openContextMenu(e: MouseEvent, c: Commit) {
  if (!selectedCommits.value.some(sc => sc.id === c.id)) selectedCommits.value = [c];
  const items: any[] = [];
  const refs = commitRefsMap.value.get(c.id) || [];
  const localBranches = refs.filter(r => r.type === 'branch');
  
  for (const b of localBranches) {
    items.push({ label: b.name, icon: 'lucide:git-branch', subItems: [
        { label: t('history_menu.copy_branch_name'), icon: 'lucide:copy', action: () => navigator.clipboard.writeText(b.name) }
    ]});
  }

  if (localBranches.length > 0) items.push({ type: 'separator' });

  items.push(
    { label: t('history_menu.create_branch'), icon: 'lucide:git-branch', action: () => createBranchFromCommit(c.id) },
    { label: t('history_menu.create_tag'), icon: 'lucide:tag', action: () => createTagFromCommit(c.id) },
    { type: 'separator' },
    { label: t('history_menu.reword'), icon: 'lucide:edit-3', action: () => rewordCommitAction(c.id, c.summary || '') },
    { label: t('history_menu.squash'), icon: 'lucide:minimize-2', action: () => squashCommitAction(c.id) },
    { label: t('history_menu.revert'), icon: 'lucide:undo-2', action: () => revertCommitAction(c.id, c.summary || '') },
    { type: 'separator' },
    { label: t('history_menu.copy_sha'), icon: 'lucide:copy', action: () => navigator.clipboard.writeText(c.id) }
  );

  contextMenu.value = { x: e.clientX, y: e.clientY, items };
}
</script>

<template>
  <div class="flex flex-row flex-1 min-h-0 min-w-0 overflow-hidden bg-white dark:bg-[#1E1E1E]">
    <HistoryCommitList
      ref="commitListRef"
      class="flex-1 min-w-0"
      :log="log"
      :graphOutput="graphOutput"
      :selectedCommits="selectedCommits"
      :commitRefsMap="commitRefsMap"
      :isLoadingData="isLoadingData"
      :selectedLogRef="selectedLogRef"
      :dateFormat="generalSettings.dateFormat"
      :showTagsInGraph="generalSettings.showTagsInGraph"
      @select="selectCommit"
      @contextMenu="openContextMenu"
      @clearRef="selectedLogRef = ''; loadRepoData(true)"
      @loadMore="loadMoreLog"
    />

    <HistoryDetailPanel
      v-if="selectedCommits.length > 0"
      :requestedTab="detailRequestedTab"
      :selectedCommits="selectedCommits"
      :commitRefs="commitRefsMap.get(selectedCommit?.id) || []"
      :commitFilesList="commitFilesList"
      :selectedCommitFile="selectedCommitFile"
      :commitOriginal="commitOriginal"
      :commitModified="commitModified"
      :fullRepoFilesList="fullRepoFilesList"
      :selectedFilesTabPath="selectedFilesTabPath"
      :filesTabContent="filesTabContent"
      :isTreeLoading="isTreeLoading"
      @close="selectedCommits = []"
      @explain="handleExplainCommits"
      @navigate="navigateToCommit"
      @selectChange="selectedCommitFile = $event"
      @selectFile="selectedFilesTabPath = $event"
      @setTab="activeDetailTab = $event"
    />

    <!-- AI commit analysis -->
    <Modal v-model="aiModalOpen" :title="t('history_detail.ai_explain_title')" width="760px">
      <div class="p-6 max-h-[70vh] overflow-y-auto">
        <div v-if="aiLoading" class="flex items-center gap-2 text-neutral-500 text-sm py-6 justify-center">
          <Icon icon="lucide:loader-2" class="animate-spin text-lg" /> {{ t('history_detail.ai_generating') }}
        </div>
        <div v-else class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words" v-html="renderedAiExplanation" @click="onAiExplanationClick"></div>
      </div>
    </Modal>
  </div>
</template>

<!-- Global (non-scoped): styles the AI file links injected via v-html. -->
<style>
.ai-fileref {
  cursor: pointer;
  color: #3b82f6;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}
.ai-fileref:hover {
  background: rgba(59, 130, 246, 0.14);
  border-radius: 3px;
}
</style>

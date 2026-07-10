<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';
import {
  activeTab,
  status,
  stashes,
  checkoutBranch,
  selectedLogRefs,
  currentBranchName,
  mergeBranchAction,
  renameBranch,
  deleteTag,
  addRemote,
  removeRemote,
  renameRemote,
  setRemoteUrl,
  repoPath
} from '../../services/gitService';
import { sidebarWidth, layoutRefs } from '../../services/layoutService';
import { hasActivePRProvider } from '../../services/pullRequestService';
import Resizer from '../../components/Common/Resizer.vue';
import VirtualScroll from '../../components/Common/VirtualScroll.vue';
import SearchInput from '../../components/Common/SearchInput.vue';
import { useSidebar } from '../../composables/useSidebar';
import { activePullRequest, contextMenu, requestConfirm, requestInput } from '../../services/modalService';

// Import sub-components
import SidebarItemHeader from './components/SidebarItemHeader.vue';
import SidebarItemNode from './components/SidebarItemNode.vue';
import SidebarItemTag from './components/SidebarItemTag.vue';
import SidebarItemPR from './components/SidebarItemPR.vue';
import SidebarItemSubmodule from './components/SidebarItemSubmodule.vue';

const { t } = useI18n();
const branchFilter = ref('');

const { 
  allItems, 
  sectionsCollapsed, 
  expandedGroups,
  selectBranchLog,
  toggleFilter,
  toggleGroup,
  toggleSection,
  loadPullRequests,
  createPullRequest,
  deleteBranch,
  revealCurrentBranch
} = useSidebar(branchFilter);

const vscrollRef = ref<any>(null);

// On repo open, expand the current branch's folder and scroll it into view so
// the user immediately sees where they are. Runs once per repo (not on every
// checkout) to avoid yanking the scroll around while they work.
let lastRevealedRepo = '';
async function maybeRevealCurrentBranch() {
  if (!repoPath.value || !currentBranchName.value) return;
  if (lastRevealedRepo === repoPath.value) return;
  lastRevealedRepo = repoPath.value;
  const idx = revealCurrentBranch();
  if (idx >= 0) {
    await nextTick();
    vscrollRef.value?.scrollTo?.(idx);
  }
}
watch([repoPath, currentBranchName], maybeRevealCurrentBranch, { immediate: true });

function getItemHeight(index: number, item: any) {
  if (item.type === 'pr') return 52;
  return 28;
}

function openPullRequest(pr: any) {
    activePullRequest.value = pr;
    activeTab.value = 'pull_request';
}

function showBranchMenu(e: MouseEvent, branchName: string) {
  const isCurrent = branchName === currentBranchName.value;
  const items: any[] = [
    { label: t('common.checkout'), action: () => checkoutBranch(branchName), icon: 'lucide:git-compare' },
    { label: t('common.history'), action: () => selectBranchLog(branchName), icon: 'lucide:history' },
  ];
  if (!isCurrent && currentBranchName.value) {
    items.push({
      label: t('branch_menu.merge_into_current', { branch: currentBranchName.value }),
      action: () => mergeBranchAction(branchName),
      icon: 'lucide:git-merge',
    });
  }
  items.push(
    { separator: true },
    { label: t('branch_menu.rename'), icon: 'lucide:pencil', action: () => requestInput(t('branch_menu.rename_title'), t('branch_menu.rename_msg', { branch: branchName }), '', branchName, t('common.rename'), (newName: string) => {
        if (newName && newName !== branchName) renameBranch(branchName, newName);
    }) },
    { label: t('common.delete'), action: () => requestConfirm(t('branch_menu.delete_title'), t('branch_menu.delete_msg', { branch: branchName }), true, () => deleteBranch(branchName)), icon: 'lucide:trash-2', danger: true },
  );

  contextMenu.value = { x: e.clientX, y: e.clientY, items };
}

function showTagMenu(e: MouseEvent, tagName: string) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('common.history'), action: () => selectBranchLog(tagName), icon: 'lucide:history' },
      { label: t('tag_menu.copy_name'), icon: 'lucide:copy', action: () => navigator.clipboard.writeText(tagName) },
      { separator: true },
      { label: t('common.delete'), icon: 'lucide:trash-2', danger: true, action: () => requestConfirm(t('tag_menu.delete_title'), t('tag_menu.delete_msg', { tag: tagName }), true, () => deleteTag(tagName)) },
    ]
  };
}

function showRemoteMenu(e: MouseEvent, remoteName: string) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('common.history'), action: () => selectBranchLog(remoteName), icon: 'lucide:history' }
    ]
  };
}

/** Context menu for a remote *root* node (e.g. "origin") — manage the remote itself. */
function showRemoteRootMenu(e: MouseEvent, remoteName: string) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('remote_menu.edit_url'), icon: 'lucide:link', action: async () => {
          let current = '';
          try { current = await window.gitbox.getRemoteUrl(repoPath.value, remoteName); } catch { /* ignore */ }
          requestInput(t('remote_menu.edit_url_title'), t('remote_menu.edit_url_msg', { remote: remoteName }), 'https://...', current, t('common.confirm'), (url: string) => {
            if (url && url !== current) setRemoteUrl(remoteName, url);
          });
      } },
      { label: t('branch_menu.rename'), icon: 'lucide:pencil', action: () => requestInput(t('remote_menu.rename_title'), t('remote_menu.rename_msg', { remote: remoteName }), '', remoteName, t('common.rename'), (newName: string) => {
          if (newName && newName !== remoteName) renameRemote(remoteName, newName);
      }) },
      { separator: true },
      { label: t('common.delete'), icon: 'lucide:trash-2', danger: true, action: () => requestConfirm(t('remote_menu.remove_title'), t('remote_menu.remove_msg', { remote: remoteName }), true, () => removeRemote(remoteName)) },
    ]
  };
}

/** Add a new remote — prompt for a name, then its URL. */
function addRemoteAction() {
  requestInput(t('remote_menu.add_name_title'), t('remote_menu.add_name_msg'), 'origin', 'origin', t('common.confirm'), (name: string) => {
    if (!name) return;
    requestInput(t('remote_menu.add_url_title'), t('remote_menu.add_url_msg', { remote: name }), 'https://...', '', t('common.confirm'), (url: string) => {
      if (url) addRemote(name, url);
    });
  });
}
</script>

<template>
  <aside class="flex flex-col border-r border-line bg-app flex-shrink-0 relative select-none min-h-0 overflow-hidden" :style="{ width: sidebarWidth + 'px' }">
    <Resizer :target="layoutRefs.sidebarWidth" :options="{ min: 150, max: 800 }" class="absolute right-0 top-0 bottom-0" />
    
    <!-- Tab buttons -->
    <div class="v-stack py-2 border-b border-line">
      <button :class="cn(
          'px-3 h-8 h-stack justify-between hover:bg-surface-hover',
          activeTab === 'history' ? 'bg-accent/20 text-content-strong' : ''
        )"
        @click="activeTab = 'history'">
        <span class="font-bold text-xs h-stack gap-1.5"><Icon icon="lucide:history" /> {{ t('common.history') }}</span>
      </button>
      <button :class="cn(
          'px-3 h-8 h-stack justify-between hover:bg-surface-hover',
          activeTab === 'local_changes' ? 'bg-accent/20 text-content-strong' : ''
        )"
        @click="activeTab = 'local_changes'">
        <span class="font-bold text-xs h-stack gap-1.5"><Icon icon="lucide:file-edit" /> {{ t('common.local_changes') }}</span>
        <span class="bg-surface-hover text-content-muted text-[10px] px-1.5 rounded-full" v-if="status.length">{{ status.length }}</span>
      </button>
      <button :class="cn(
          'px-3 h-8 h-stack justify-between hover:bg-surface-hover',
          activeTab === 'stashes' ? 'bg-accent/20 text-content-strong' : ''
        )"
        @click="activeTab = 'stashes'">
        <span class="font-bold text-xs h-stack gap-1.5"><Icon icon="lucide:layers" /> {{ t('common.stashes') }}</span>
        <span class="bg-surface-hover text-content-muted text-[10px] px-1.5 rounded-full" v-if="stashes.length">{{ stashes.length }}</span>
      </button>
    </div>
    
    <!-- Lists -->
    <div class="v-stack flex-1 min-h-0">
      <!-- Filter -->
      <div class="p-2 border-b border-line">
        <SearchInput v-model="branchFilter" />
      </div>
      
      <!-- Unified Virtual Scroll -->
      <div class="flex-1 overflow-hidden relative">
        <VirtualScroll ref="vscrollRef" :items="allItems" :item-height="getItemHeight" :overscan="20">
            <template #default="{ item }">
                <SidebarItemHeader 
                    v-if="item.data.type === 'header'" 
                    :item="item.data" 
                    :has-active-p-r-provider="hasActivePRProvider"
                    @toggle="toggleSection"
                    @refreshPRs="loadPullRequests"
                    @createPR="createPullRequest"
                    @addRemote="addRemoteAction" />

                <SidebarItemNode 
                    v-else-if="item.data.type === 'node'" 
                    :node="item.data.node"
                    :section="item.data.section"
                    :selected-log-refs="selectedLogRefs"
                    :expanded-groups="expandedGroups"
                    @toggle-group="toggleGroup"
                    @select-log="selectBranchLog"
                    @checkout="checkoutBranch"
                    @toggle-filter="toggleFilter"
                    @menu="(e, name) => item.data.section === 'local'
                        ? showBranchMenu(e, name)
                        : (item.data.node.isGroup && item.data.node.level === 0 ? showRemoteRootMenu(e, name) : showRemoteMenu(e, name))" />

                <SidebarItemTag
                    v-else-if="item.data.type === 'tag'"
                    :item="item.data"
                    :selected-log-refs="selectedLogRefs"
                    @select="selectBranchLog"
                    @toggle-filter="toggleFilter"
                    @menu="showTagMenu" />

                <SidebarItemPR 
                    v-else-if="item.data.type === 'pr'" 
                    :pr="item.data.data"
                    @open="openPullRequest" />

                <SidebarItemSubmodule 
                    v-else-if="item.data.type === 'submodule'" 
                    :id="item.data.id"
                    @select="selectBranchLog" />
            </template>
        </VirtualScroll>
      </div>
    </div>
  </aside>
</template>

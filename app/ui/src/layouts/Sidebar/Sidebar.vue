<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';
import {
  activeTab,
  status,
  stashes,
  checkoutBranch,
  selectedLogRef,
  currentBranchName,
  mergeBranchAction
} from '../../services/gitService';
import { sidebarWidth, layoutRefs } from '../../services/layoutService';
import { hasActivePRProvider } from '../../services/pullRequestService';
import Resizer from '../../components/Common/Resizer.vue';
import VirtualScroll from '../../components/Common/VirtualScroll.vue';
import { useSidebar } from '../../composables/useSidebar';
import { activePullRequest, contextMenu, requestConfirm } from '../../services/modalService';

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
  deleteBranch
} = useSidebar(branchFilter);

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
    { label: t('common.delete'), action: () => requestConfirm(t('branch_menu.delete_title'), t('branch_menu.delete_msg', { branch: branchName }), true, () => deleteBranch(branchName)), icon: 'lucide:trash-2', danger: true },
  );

  contextMenu.value = { x: e.clientX, y: e.clientY, items };
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
</script>

<template>
  <aside class="flex flex-col border-r border-line bg-app flex-shrink-0 relative select-none min-h-0 overflow-hidden" :style="{ width: sidebarWidth + 'px' }">
    <Resizer :target="layoutRefs.sidebarWidth" :options="{ min: 150, max: 800 }" class="absolute right-0 top-0 bottom-0" />
    
    <!-- Tab buttons -->
    <div class="v-stack py-2 border-b border-line">
      <button :class="cn(
          'px-3 h-8 h-stack justify-between hover:bg-neutral-200 dark:hover:bg-neutral-800',
          activeTab === 'history' ? 'bg-surface-hover text-content-strong' : ''
        )"
        @click="activeTab = 'history'">
        <span class="font-bold text-xs h-stack gap-1.5"><Icon icon="lucide:history" /> {{ t('common.history') }}</span>
      </button>
      <button :class="cn(
          'px-3 h-8 h-stack justify-between hover:bg-neutral-200 dark:hover:bg-neutral-800',
          activeTab === 'local_changes' ? 'bg-surface-hover text-content-strong' : ''
        )"
        @click="activeTab = 'local_changes'">
        <span class="font-bold text-xs h-stack gap-1.5"><Icon icon="lucide:file-edit" /> {{ t('common.local_changes') }}</span>
        <span class="bg-neutral-300 dark:bg-neutral-700 text-[10px] px-1.5 rounded-full" v-if="status.length">{{ status.length }}</span>
      </button>
      <button :class="cn(
          'px-3 h-8 h-stack justify-between hover:bg-neutral-200 dark:hover:bg-neutral-800',
          activeTab === 'stashes' ? 'bg-surface-hover text-content-strong' : ''
        )"
        @click="activeTab = 'stashes'">
        <span class="font-bold text-xs h-stack gap-1.5"><Icon icon="lucide:layers" /> {{ t('common.stashes') }}</span>
        <span class="bg-neutral-300 dark:bg-neutral-700 text-[10px] px-1.5 rounded-full" v-if="stashes.length">{{ stashes.length }}</span>
      </button>
    </div>
    
    <!-- Lists -->
    <div class="v-stack flex-1 min-h-0">
      <!-- Filter -->
      <div class="p-2 border-b border-line">
        <div class="relative h-stack">
          <Icon icon="lucide:search" class="absolute left-2 text-neutral-500 text-xs" />
          <input v-model="branchFilter" class="w-full bg-surface border border-line pl-6 pr-2 py-1 text-xs text-content outline-none rounded focus:border-neutral-500" :placeholder="t('common.search')" />
        </div>
      </div>
      
      <!-- Unified Virtual Scroll -->
      <div class="flex-1 overflow-hidden relative">
        <VirtualScroll :items="allItems" :item-height="getItemHeight" :overscan="20">
            <template #default="{ item }">
                <SidebarItemHeader 
                    v-if="item.data.type === 'header'" 
                    :item="item.data" 
                    :has-active-p-r-provider="hasActivePRProvider"
                    @toggle="toggleSection"
                    @refreshPRs="loadPullRequests"
                    @createPR="createPullRequest" />

                <SidebarItemNode 
                    v-else-if="item.data.type === 'node'" 
                    :node="item.data.node"
                    :section="item.data.section"
                    :selected-log-ref="selectedLogRef"
                    :expanded-groups="expandedGroups"
                    @toggle-group="toggleGroup"
                    @select-log="selectBranchLog"
                    @checkout="checkoutBranch"
                    @toggle-filter="toggleFilter"
                    @menu="(e, name) => item.data.section === 'local' ? showBranchMenu(e, name) : showRemoteMenu(e, name)" />

                <SidebarItemTag 
                    v-else-if="item.data.type === 'tag'" 
                    :item="item.data"
                    :selected-log-ref="selectedLogRef"
                    @select="selectBranchLog"
                    @toggle-filter="toggleFilter" />

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

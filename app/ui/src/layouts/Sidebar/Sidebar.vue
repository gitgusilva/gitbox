<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { 
  branches, 
  activeTab, 
  status, 
  stashes,
  selectedLogRef,
  checkoutBranch,
  loadRepoData,
  log,
  selectedCommit,
  remotes, 
  tags
} from '../../services/gitService';
import { sidebarWidth, startResize } from '../../services/layoutService';
import { loadPullRequests } from '../../services/pullRequestService';
import LocalBranchesSection from './components/LocalBranchesSection.vue';
import RemotesSection from './components/RemotesSection.vue';
import TagsSection from './components/TagsSection.vue';
import SubmodulesSection from './components/SubmodulesSection.vue';
import PullRequestsSection from './components/PullRequestsSection.vue';

const { t } = useI18n();

const branchFilter = ref('');

onMounted(() => {
    loadPullRequests();
});
</script>

<template>
  <aside class="flex flex-col border-r border-neutral-800 bg-[#1E1E1E] flex-shrink-0 relative select-none" :style="{ width: sidebarWidth + 'px' }">
    <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 transition-colors" @mousedown="startResize('sidebar', $event)"></div>
    
    <!-- Tab buttons -->
    <div class="flex flex-col py-2 border-b border-neutral-800">
      <button class="px-3 h-8 flex items-center justify-between hover:bg-neutral-800" 
              :class="activeTab === 'history' ? 'bg-[#37373D] text-white' : ''" 
              @click="activeTab = 'history'">
        <span class="font-bold text-xs flex items-center gap-1.5"><Icon icon="lucide:history" /> {{ t('common.history') }}</span>
      </button>
      <button class="px-3 h-8 flex items-center justify-between hover:bg-neutral-800" 
              :class="activeTab === 'local_changes' ? 'bg-[#37373D] text-white' : ''" 
              @click="activeTab = 'local_changes'">
        <span class="font-bold text-xs flex items-center gap-1.5"><Icon icon="lucide:file-edit" /> {{ t('common.local_changes') }}</span>
        <span class="bg-neutral-700 text-[10px] px-1.5 rounded-full" v-if="status.length">{{ status.length }}</span>
      </button>
      <button class="px-3 h-8 flex items-center justify-between hover:bg-neutral-800" 
              :class="activeTab === 'stashes' ? 'bg-[#37373D] text-white' : ''" 
              @click="activeTab = 'stashes'">
        <span class="font-bold text-xs flex items-center gap-1.5"><Icon icon="lucide:layers" /> {{ t('common.stashes') }}</span>
        <span class="bg-neutral-700 text-[10px] px-1.5 rounded-full" v-if="stashes.length">{{ stashes.length }}</span>
      </button>
    </div>
    
    <!-- Lists -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="p-2 border-b border-neutral-800">
        <div class="relative flex items-center">
          <Icon icon="lucide:search" class="absolute left-2 text-neutral-500 text-xs" />
          <input v-model="branchFilter" class="w-full bg-[#252526] border border-neutral-800 pl-6 pr-2 py-1 text-xs text-neutral-300 outline-none rounded focus:border-neutral-500" :placeholder="t('common.search')" />
        </div>
      </div>
      
      <div class="flex-1 mt-2 pb-4 overflow-y-auto overflow-x-hidden">
        <LocalBranchesSection :branchFilter="branchFilter" />
        <RemotesSection :branchFilter="branchFilter" />
        <TagsSection :branchFilter="branchFilter" />
        <PullRequestsSection :branchFilter="branchFilter" />
        <SubmodulesSection :branchFilter="branchFilter" />
      </div>
    </div>
  </aside>
</template>

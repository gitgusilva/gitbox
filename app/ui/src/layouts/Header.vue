<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { computed, ref } from 'vue';
import { 
  doFetch, 
  doPull, 
  doPush, 
  discardAll,
  isLoading,
  toggleTerminal,
  isTerminalOpen,
  repoPath,
  branches,
  checkoutBranch,
  createBranchAction
} from '../services/gitService';
import { 
  addWorkspaceFlow, 
  workspaces, 
  activeWorkspaceId, 
  setActiveWorkspace, 
  removeWorkspace 
} from '../services/workspaceService';
import { isSettingsOpen } from '../services/modalService';
import SettingsModal from '../components/Settings/SettingsModal.vue';
import SelectMenu from '../components/SelectMenu.vue';
import IconButton from '../components/Common/IconButton.vue';

const { t } = useI18n();

const activeWorkspace = computed(() => workspaces.value.find(w => w.id === activeWorkspaceId.value));

const repoDisplayName = computed(() => {
    if (activeWorkspace.value?.isSubmodule && activeWorkspace.value.parentName) {
        return activeWorkspace.value.parentName;
    }
    if (!repoPath.value) return 'No Repository';
    const parts = repoPath.value.split(/[\/\\]/);
    return parts[parts.length - 1] || 'Unknown';
});

const currentBranch = computed(() => {
    const branch = branches.value.find(b => b.is_head);
    return branch ? branch.name : 'No Branch';
});
const repoMenuOpen = ref<{ x: number, y: number, items: any[] } | null>(null);
const branchMenuOpen = ref<{ x: number, y: number, items: any[] } | null>(null);

const openRepoMenu = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const items = workspaces.value.map(w => ({
        label: w.name,
        sublabel: w.path,
        icon: 'lucide:folder',
        action: () => setActiveWorkspace(w.id),
        badge: w.id === activeWorkspaceId.value ? 'current' : ''
    }));
    
    // Add the add workspace option
    items.push({
        label: t('workspace.add'),
        sublabel: t('workspace.add_desc'),
        icon: 'lucide:plus',
        action: addWorkspaceFlow,
        badge: ''
    });

    repoMenuOpen.value = {
        x: rect.left,
        y: rect.bottom + 4,
        items
    };
};

const openBranchMenu = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const items = branches.value.map(b => ({
        label: b.name.replace('refs/heads/', '').replace('refs/remotes/', ''),
        sublabel: b.is_remote ? 'remote' : 'local',
        icon: b.is_remote ? 'lucide:cloud' : 'lucide:git-branch',
        action: () => checkoutBranch(b.name),
        badge: b.is_head ? 'HEAD' : ''
    }));

    branchMenuOpen.value = {
        x: rect.left,
        y: rect.bottom + 4,
        items
    };
};
</script>

<template>
  <header class="flex-shrink-0 bg-neutral-100 dark:bg-[#2D2D2D] border-b border-neutral-200 dark:border-[#1E1E1E] flex items-center gap-2 px-3 py-1.5 z-20 shadow-sm pointer-events-auto relative" style="-webkit-app-region: drag;">
      
      <!-- Left side: Repo and Branch context -->
      <div class="flex items-center gap-2 mr-2 h-full py-0 min-w-[150px]" style="-webkit-app-region: no-drag;">
          <!-- Repository -->
          <div @click="openRepoMenu" class="flex flex-col justify-center cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#333333] px-2 py-0.5 rounded transition-colors group">
              <span class="text-[10px] text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 h-[14px]">repository</span>
              <div class="flex items-center gap-1 font-semibold text-[13px] h-[18px] text-black dark:text-neutral-300">
                  <span class="truncate block max-w-[120px]">{{ repoDisplayName }}</span>
                  <Icon icon="lucide:chevron-down" class="w-3.5 h-3.5 text-neutral-500 font-bold" />
              </div>
          </div>

          <template v-if="activeWorkspace?.isSubmodule">
              <Icon icon="lucide:chevron-right" class="w-4 h-4 text-neutral-400 dark:text-neutral-600" />
              <!-- Submodule -->
              <div class="flex flex-col justify-center px-2 py-0.5 rounded transition-colors group">
                  <span class="text-[10px] text-neutral-500 h-[14px]">submodule</span>
                  <div class="flex items-center gap-1 font-semibold text-[13px] h-[18px] text-black dark:text-neutral-300">
                      <span class="truncate block max-w-[120px]">{{ activeWorkspace.name }}</span>
                  </div>
              </div>
          </template>

          <Icon icon="lucide:chevron-right" class="w-4 h-4 text-neutral-400 dark:text-neutral-600" />

          <!-- Branch -->
          <div @click="openBranchMenu" class="flex flex-col justify-center cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#333333] px-2 py-0.5 rounded transition-colors group">
              <span class="text-[10px] text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 h-[14px]">branch</span>
              <div class="flex items-center gap-1 font-semibold text-[13px] h-[18px] text-black dark:text-neutral-300">
                  <span class="truncate block max-w-[150px]">{{ currentBranch }}</span>
                  <Icon icon="lucide:chevron-down" class="w-3.5 h-3.5 text-neutral-500 font-bold" />
              </div>
          </div>
      </div>

      <!-- Actions (Centered) -->
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1" style="-webkit-app-region: no-drag;">
          <IconButton icon="lucide:download-cloud" loadingIcon="lucide:loader-2" :loading="isLoading" :label="t('common.fetch')" :action="doFetch" />
          <IconButton icon="lucide:arrow-down-to-line" loadingIcon="lucide:loader-2" :loading="isLoading" :label="t('common.pull')" :action="doPull" />
          <IconButton icon="lucide:arrow-up-from-line" loadingIcon="lucide:loader-2" :loading="isLoading" :label="t('common.push')" :action="doPush" />
          <div class="w-px h-4 bg-neutral-300 dark:bg-neutral-600 mx-1"></div>
          <IconButton icon="lucide:git-branch-plus" :label="'Create Branch'" :action="createBranchAction" />
          <IconButton icon="lucide:archive-restore" :label="t('common.discard')" :action="discardAll" />
      </div>
      
      <div class="flex items-center gap-1 ml-auto" style="-webkit-app-region: no-drag;">
        <button @click="toggleTerminal" :class="isTerminalOpen ? 'text-blue-500 bg-blue-500/10' : 'text-neutral-400 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600'" class="p-1.5 rounded transition-colors" title="Toggle Terminal Focus">
          <Icon icon="lucide:terminal-square" class="text-base" />
        </button>
        <button @click="isSettingsOpen = true" class="text-neutral-400 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600 p-1.5 rounded transition-colors" title="Settings">
          <Icon icon="lucide:settings" class="text-base" />
        </button>
      </div>

      <div style="-webkit-app-region: no-drag;">
         <SelectMenu v-if="repoMenuOpen" :x="repoMenuOpen.x" :y="repoMenuOpen.y" :items="repoMenuOpen.items" :placeholder="'Search repositories...'" @close="repoMenuOpen = null" />
         <SelectMenu v-if="branchMenuOpen" :x="branchMenuOpen.x" :y="branchMenuOpen.y" :items="branchMenuOpen.items" :placeholder="'Search branches...'" @close="branchMenuOpen = null" />
         <SettingsModal v-if="isSettingsOpen" @close="isSettingsOpen = false" />
      </div>
  </header>
</template>

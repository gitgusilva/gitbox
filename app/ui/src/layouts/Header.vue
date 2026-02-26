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
  checkoutBranch
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

const { t } = useI18n();

const repoName = computed(() => {
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
  <header class="flex-shrink-0 bg-neutral-100 dark:bg-[#2D2D2D] border-b border-neutral-200 dark:border-[#1E1E1E] flex items-center gap-2 px-3 py-1.5 z-20 shadow-sm pointer-events-auto" style="-webkit-app-region: drag;">
      
      <!-- Left side: Repo and Branch context -->
      <div class="flex items-center gap-2 mr-2 h-full py-0 min-w-[150px]" style="-webkit-app-region: no-drag;">
          <!-- Repository -->
          <div @click="openRepoMenu" class="flex flex-col justify-center cursor-pointer hover:bg-neutral-200 dark:hover:bg-[#333333] px-2 py-0.5 rounded transition-colors group">
              <span class="text-[10px] text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 h-[14px]">repository</span>
              <div class="flex items-center gap-1 font-semibold text-[13px] h-[18px] text-black dark:text-neutral-300">
                  <span class="truncate block max-w-[120px]">{{ repoName }}</span>
                  <Icon icon="lucide:chevron-down" class="w-3.5 h-3.5 text-neutral-500 font-bold" />
              </div>
          </div>

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

      <div class="h-4 w-px bg-neutral-300 dark:bg-neutral-600 mx-2"></div>

      <!-- Actions -->
      <div class="flex items-center" style="-webkit-app-region: no-drag;">
          <button @click="doFetch" :disabled="isLoading" class="text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors text-xs disabled:opacity-50 disabled:cursor-wait">
            <Icon :icon="isLoading ? 'lucide:loader-2' : 'lucide:download-cloud'" :class="{ 'animate-spin': isLoading }" /> <span>{{ t('common.fetch') }}</span>
          </button>
          <button @click="doPull" :disabled="isLoading" class="text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors text-xs disabled:opacity-50 disabled:cursor-wait">
            <Icon :icon="isLoading ? 'lucide:loader-2' : 'lucide:arrow-down-to-line'" :class="{ 'animate-spin': isLoading }" /> <span>{{ t('common.pull') }}</span>
          </button>
          <button @click="doPush" :disabled="isLoading" class="text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors text-xs disabled:opacity-50 disabled:cursor-wait">
            <Icon :icon="isLoading ? 'lucide:loader-2' : 'lucide:arrow-up-from-line'" :class="{ 'animate-spin': isLoading }" /> <span>{{ t('common.push') }}</span>
          </button>
          <button @click="discardAll" class="text-neutral-500 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600 px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors text-xs mx-1">
            <Icon icon="lucide:archive-restore" /> <span>{{ t('common.discard') }}</span>
          </button>
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

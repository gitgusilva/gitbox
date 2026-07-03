<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { recentRepositories, openRepository, addWorkspaceFlow } from '../services/workspaceService';
import RepoActionModal from '../components/RepoActionModal.vue';

const { t } = useI18n();

const repoModalType = ref<'init' | 'clone' | null>(null);

async function handleAddWorkspace() {
  await addWorkspaceFlow();
}

function handleClone() {
    repoModalType.value = 'clone';
}

function handleCreate() {
    repoModalType.value = 'init';
}
function removeRecent(path: string) {
    recentRepositories.value = recentRepositories.value.filter(r => r.path !== path);
}

const searchQuery = ref('');

const filteredRecents = computed(() => {
    if (!searchQuery.value) return recentRepositories.value;
    const q = searchQuery.value.toLowerCase();
    return recentRepositories.value.filter(r => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q));
});
</script>

<template>
  <div class="h-full flex flex-col bg-app text-content font-sans" style="font-family: Inter, system-ui, sans-serif;">
     <div class="flex-1 flex w-full max-w-[1200px] mx-auto px-12 py-16 gap-20">
        
        <!-- Left Column -->
        <div class="flex flex-col w-5/12 min-w-[350px]">
            <h2 class="text-[20px] text-content mb-8 font-semibold tracking-tight">{{ t('view.repositories') }}</h2>
            
            <div class="flex items-center gap-3 mb-10 w-full">
                <button @click="handleAddWorkspace" class="flex-1 py-2 px-3 bg-surface hover:bg-neutral-200 dark:hover:bg-[#3D3E40] text-content rounded font-medium text-[13px] border border-line-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:folder-open" class="w-4 h-4 opacity-70" /> {{ t('view.open') }}
                </button>
                <button @click="handleClone" class="flex-1 py-2 px-3 bg-surface hover:bg-neutral-200 dark:hover:bg-[#3D3E40] text-content rounded font-medium text-[13px] border border-line-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:cloud-download" class="w-4 h-4 opacity-70" /> {{ t('view.clone') }}
                </button>
                <button @click="handleCreate" class="flex-1 py-2 px-3 bg-surface hover:bg-neutral-200 dark:hover:bg-[#3D3E40] text-content rounded font-medium text-[13px] border border-line-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:plus-square" class="w-4 h-4 opacity-70" /> {{ t('view.create') }}
                </button>
            </div>

            <div class="flex flex-col flex-1 min-h-0">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-[12px] text-neutral-500">{{ t('view.recent') }}</span>
                    <div class="relative w-40 flex items-center">
                      <Icon icon="lucide:search" class="absolute left-2.5 w-3 h-3 text-neutral-500" />
                      <input v-model="searchQuery" type="text" :placeholder="t('common.search')" class="w-full bg-app border border-line text-[12px] rounded-full pl-7 pr-3 py-1 outline-none focus:border-accent transition-colors placeholder:text-neutral-600 text-content shadow-inner" />
                    </div>
                </div>

                <div v-if="filteredRecents.length === 0" class="py-6 text-[13px] text-neutral-500 italic text-center opacity-70">
                   {{ t('view.no_recent_repositories') }}
                </div>
                
                <div v-else class="flex flex-col max-h-[450px] overflow-y-auto custom-scrollbar -mx-3 px-3">
                    <div v-for="(repo, idx) in filteredRecents" :key="idx" 
                         @click="openRepository(repo.path, repo.name)"
                         class="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-200 dark:hover:bg-[#2A2B2E] cursor-pointer transition-colors mb-0.5">
                         <div class="flex flex-col gap-0.5 overflow-hidden w-full">
                             <span class="font-bold text-[13px] text-[#4FA5E2] group-hover:text-[#5FB5F2] truncate tracking-wide">{{ repo.name }}</span>
                             <span class="text-[11px] text-neutral-500 truncate opacity-60 font-mono">{{ repo.path }}</span>
                         </div>
                         <button @click.stop="removeRecent(repo.path)" class="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity ml-3 p-1 shrink-0">
                             <Icon icon="lucide:x" class="w-3.5 h-3.5" />
                         </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Column -->
        <div class="flex flex-col w-7/12 pl-12 border-l border-line/50 pt-2">
             <h2 class="text-[17px] text-content mb-6 tracking-tight">{{ t('view.boost_workflow') }}</h2>
             <p class="text-[13px] text-content-muted mb-8 leading-relaxed max-w-lg">
                 {{ t('view.boost_workflow_desc') }}
             </p>
             <button class="w-fit py-2 px-5 bg-surface hover:bg-neutral-200 dark:hover:bg-[#3D3E40] border border-line-strong rounded text-[13px] text-content font-medium mb-12 flex items-center gap-2 transition-colors shadow-sm">
                 {{ t('view.explore_features') }} <Icon icon="lucide:external-link" class="w-3.5 h-3.5 opacity-60" />
             </button>

             <h3 class="text-[12px] text-neutral-500 mb-4 tracking-wider uppercase">{{ t('view.resources') }}</h3>
             <ul class="flex flex-col gap-3">
                 <li><a href="#" class="text-[13px] text-[#4FA5E2] hover:underline hover:text-[#5FB5F2] transition-colors">{{ t('view.intro_tutorials') }}</a></li>
                 <li><a href="#" class="text-[13px] text-[#4FA5E2] hover:underline hover:text-[#5FB5F2] transition-colors">{{ t('view.release_notes') }}</a></li>
                 <li><a href="#" class="text-[13px] text-[#4FA5E2] hover:underline hover:text-[#5FB5F2] transition-colors flex items-center gap-1.5 w-fit">{{ t('view.documentation') }} <Icon icon="lucide:external-link" class="w-3 h-3" /></a></li>
             </ul>
        </div>
     </div>

     <RepoActionModal v-if="repoModalType" :action="repoModalType" @close="repoModalType = null" />
  </div>
</template>

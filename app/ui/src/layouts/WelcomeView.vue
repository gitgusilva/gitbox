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
  <div class="h-full flex flex-col bg-[#1E1E1E] text-neutral-300 font-sans" style="font-family: Inter, system-ui, sans-serif;">
     <div class="flex-1 flex w-full max-w-[1200px] mx-auto px-12 py-16 gap-20">
        
        <!-- Left Column -->
        <div class="flex flex-col w-5/12 min-w-[350px]">
            <h2 class="text-[20px] text-neutral-300 mb-8 font-semibold tracking-tight">Repositories</h2>
            
            <div class="flex items-center gap-3 mb-10 w-full">
                <button @click="handleAddWorkspace" class="flex-1 py-2 px-3 bg-[#2D2E30] hover:bg-[#3D3E40] text-neutral-200 rounded font-medium text-[13px] border border-[#3E4044] transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:folder-open" class="w-4 h-4 opacity-70" /> Open
                </button>
                <button @click="handleClone" class="flex-1 py-2 px-3 bg-[#2D2E30] hover:bg-[#3D3E40] text-neutral-200 rounded font-medium text-[13px] border border-[#3E4044] transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:cloud-download" class="w-4 h-4 opacity-70" /> Clone
                </button>
                <button @click="handleCreate" class="flex-1 py-2 px-3 bg-[#2D2E30] hover:bg-[#3D3E40] text-neutral-200 rounded font-medium text-[13px] border border-[#3E4044] transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:plus-square" class="w-4 h-4 opacity-70" /> Create
                </button>
            </div>

            <div class="flex flex-col flex-1 min-h-0">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-[12px] text-neutral-500">Recent</span>
                    <div class="relative w-40">
                      <Icon icon="lucide:search" class="absolute left-2.5 top-1.5 w-3 h-3 text-neutral-500" />
                      <input v-model="searchQuery" type="text" placeholder="Search..." class="w-full bg-[#1A1A1A] border border-[#2D2D2D] text-[12px] rounded-full pl-7 pr-3 py-1 outline-none focus:border-blue-500 transition-colors placeholder:text-neutral-600 text-neutral-300 shadow-inner" />
                    </div>
                </div>

                <div v-if="filteredRecents.length === 0" class="py-6 text-[13px] text-neutral-500 italic text-center opacity-70">
                   No recent repositories
                </div>
                
                <div v-else class="flex flex-col max-h-[450px] overflow-y-auto custom-scrollbar -mx-3 px-3">
                    <div v-for="(repo, idx) in filteredRecents" :key="idx" 
                         @click="openRepository(repo.path, repo.name)"
                         class="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#2A2B2E] cursor-pointer transition-colors mb-0.5">
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
        <div class="flex flex-col w-7/12 pl-12 border-l border-[#2D2D2D]/50 pt-2">
             <h2 class="text-[17px] text-neutral-200 mb-6 tracking-tight">Boost Your Workflow with GitBox</h2>
             <p class="text-[13px] text-neutral-400 mb-8 leading-relaxed max-w-lg">
                 Manage all your repositories intelligently without stepping outside the ecosystem. Explore history, interact with branches, stashes and diffs in a blazing fast native desktop experience.
             </p>
             <button class="w-fit py-2 px-5 bg-[#2D2E30] hover:bg-[#3D3E40] border border-[#3E4044] rounded text-[13px] text-neutral-200 font-medium mb-12 flex items-center gap-2 transition-colors shadow-sm">
                 Explore Features <Icon icon="lucide:external-link" class="w-3.5 h-3.5 opacity-60" />
             </button>

             <h3 class="text-[12px] text-neutral-500 mb-4 tracking-wider uppercase">Resources</h3>
             <ul class="flex flex-col gap-3">
                 <li><a href="#" class="text-[13px] text-[#4FA5E2] hover:underline hover:text-[#5FB5F2] transition-colors">Intro Tutorials</a></li>
                 <li><a href="#" class="text-[13px] text-[#4FA5E2] hover:underline hover:text-[#5FB5F2] transition-colors">Release Notes</a></li>
                 <li><a href="#" class="text-[13px] text-[#4FA5E2] hover:underline hover:text-[#5FB5F2] transition-colors flex items-center gap-1.5 w-fit">Documentation <Icon icon="lucide:external-link" class="w-3 h-3" /></a></li>
             </ul>
        </div>
     </div>

     <RepoActionModal v-if="repoModalType" :action="repoModalType" @close="repoModalType = null" />
  </div>
</template>

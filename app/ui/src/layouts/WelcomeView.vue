<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { recentRepositories, openRepository, addWorkspaceFlow } from '../services/workspaceService';
import { isSettingsOpen, settingsActiveSection, isShortcutsModalOpen } from '../services/modalService';
import RepoActionModal from '../components/RepoActionModal.vue';
import SearchInput from '../components/Common/SearchInput.vue';

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

function openExternal(url: string) {
    if (window.gitbox && (window.gitbox as any).openExternal) (window.gitbox as any).openExternal(url);
}
function openSettings() {
    settingsActiveSection.value = 'general';
    isSettingsOpen.value = true;
}
function openShortcuts() {
    isShortcutsModalOpen.value = true;
}

// Genuinely useful entry points for a git client's start screen — each does
// something real (settings, shortcuts, docs, support), unlike the dead promo links.
const quickLinks = computed(() => [
    { icon: 'lucide:settings', label: t('settings.title'), action: openSettings },
    { icon: 'lucide:keyboard', label: t('common.keyboard_shortcuts'), action: openShortcuts },
    { icon: 'lucide:life-buoy', label: t('common.support'), external: true, action: () => openExternal('https://discord.gg/gitbox') },
]);
</script>

<template>
  <div class="h-full flex flex-col bg-app text-content font-sans" style="font-family: Inter, system-ui, sans-serif;">
     <div class="flex-1 flex w-full max-w-[1200px] mx-auto px-12 py-16 gap-20">

        <!-- Left Column -->
        <div class="flex flex-col w-5/12 min-w-[350px]">
            <h2 class="text-[20px] text-content-strong mb-8 font-semibold tracking-tight">{{ t('view.repositories') }}</h2>

            <div class="flex items-center gap-3 mb-10 w-full">
                <button @click="handleAddWorkspace" class="flex-1 py-2 px-3 bg-surface hover:bg-surface-hover text-content rounded font-medium text-[13px] border border-line-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:folder-open" class="w-4 h-4 opacity-70" /> {{ t('view.open') }}
                </button>
                <button @click="handleClone" class="flex-1 py-2 px-3 bg-surface hover:bg-surface-hover text-content rounded font-medium text-[13px] border border-line-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:cloud-download" class="w-4 h-4 opacity-70" /> {{ t('view.clone') }}
                </button>
                <button @click="handleCreate" class="flex-1 py-2 px-3 bg-surface hover:bg-surface-hover text-content rounded font-medium text-[13px] border border-line-strong transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Icon icon="lucide:plus-square" class="w-4 h-4 opacity-70" /> {{ t('view.create') }}
                </button>
            </div>

            <div class="flex flex-col flex-1 min-h-0">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-[12px] text-content-muted">{{ t('view.recent') }}</span>
                    <div class="w-44">
                      <SearchInput v-model="searchQuery" />
                    </div>
                </div>

                <div v-if="filteredRecents.length === 0" class="py-6 text-[13px] text-content-muted italic text-center opacity-70">
                   {{ t('view.no_recent_repositories') }}
                </div>

                <div v-else class="flex flex-col max-h-[450px] overflow-y-auto custom-scrollbar -mx-3 px-3">
                    <div v-for="(repo, idx) in filteredRecents" :key="idx"
                         @click="openRepository(repo.path, repo.name)"
                         class="group flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors mb-0.5">
                         <div class="flex flex-col gap-0.5 overflow-hidden w-full">
                             <span class="font-bold text-[13px] text-accent group-hover:text-accent-hover truncate tracking-wide">{{ repo.name }}</span>
                             <span class="text-[11px] text-content-muted truncate opacity-60 font-mono">{{ repo.path }}</span>
                         </div>
                         <button @click.stop="removeRecent(repo.path)" class="opacity-0 group-hover:opacity-100 text-content-muted hover:text-red-400 transition-opacity ml-3 p-1 shrink-0">
                             <Icon icon="lucide:x" class="w-3.5 h-3.5" />
                         </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Column -->
        <div class="flex flex-col w-7/12 pl-12 border-l border-line/50 pt-2">
             <h2 class="text-[17px] text-content-strong mb-6 tracking-tight">{{ t('view.boost_workflow') }}</h2>
             <p class="text-[13px] text-content-muted mb-8 leading-relaxed max-w-lg">
                 {{ t('view.boost_workflow_desc') }}
             </p>
             <h3 class="text-[12px] text-content-muted mb-4 mt-4 tracking-wider uppercase">{{ t('view.resources') }}</h3>
             <div class="grid grid-cols-2 gap-2 max-w-md">
                 <button v-for="link in quickLinks" :key="link.label" @click="link.action"
                         class="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-surface border border-line hover:border-accent/40 hover:bg-surface-hover transition-all text-left">
                     <span class="w-7 h-7 shrink-0 center rounded-md bg-accent/10 text-accent">
                         <Icon :icon="link.icon" class="w-3.5 h-3.5" />
                     </span>
                     <span class="text-[12px] font-medium text-content group-hover:text-content-strong truncate flex items-center gap-1">
                         {{ link.label }}
                         <Icon v-if="link.external" icon="lucide:external-link" class="w-2.5 h-2.5 opacity-50" />
                     </span>
                 </button>
             </div>
        </div>
     </div>

     <RepoActionModal v-if="repoModalType" :action="repoModalType" @close="repoModalType = null" />
  </div>
</template>

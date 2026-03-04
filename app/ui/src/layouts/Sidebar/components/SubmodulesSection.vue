<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { submodules, repoPath, activeTab, loadRepoData } from '../../../services/gitService';
import { contextMenu, requestConfirm, isAddSubmoduleOpen, isEditSubmoduleOpen, activeSubmodule } from '../../../services/modalService';
import { showToast } from '../../../services/toastService';
import { openRepository, activeWorkspaceId, workspaces } from '../../../services/workspaceService';

const props = defineProps<{
  branchFilter: string;
}>();

const { t } = useI18n();

const isCollapsed = ref(false);

const filteredSubmodules = computed(() => {
    let result = submodules.value;
    if (props.branchFilter) {
        const filter = props.branchFilter.toLowerCase();
        result = result.filter(m => m.path.toLowerCase().includes(filter));
    }
    return result;
});

function openSubmoduleContextMenu(e: MouseEvent, index: number, sub: any) {
    e.preventDefault();
    contextMenu.value = {
        x: e.clientX,
        y: e.clientY,
        items: [
            { label: 'Commit Changes', icon: 'lucide:git-commit', action: () => openSubmodule(sub, 'local_changes') },
            { label: 'Update ' + sub.path, icon: 'lucide:refresh-cw', action: () => updateSubmodule(sub) },
            { label: 'Edit ' + sub.path, icon: 'lucide:edit-3', action: () => editSubmodule(sub) },
            { label: 'Open this submodule', icon: 'lucide:folder-open', action: () => openSubmodule(sub) },
            { label: 'Delete this submodule', icon: 'lucide:trash-2', action: () => deleteSubmodule(sub) }
        ]
    };
}

function openSubmodule(sub: any, tab?: 'local_changes') {
    const parentName = repoPath.value.split(/[/\\]/).pop() || 'Repo';
    openRepository(repoPath.value + '/' + sub.path, sub.path, true, parentName, repoPath.value);
    if (tab) {
        activeTab.value = tab;
    }
}

async function updateSubmodule(sub: any) {
    try {
        await window.gitbox.updateSubmodule(repoPath.value, sub.path);
        showToast('Success', `Submodule ${sub.path} updated successfully.`, 'success');
        loadRepoData(true);
    } catch (e: any) {
        showToast('Error', e.message, 'error');
    }
}

function editSubmodule(sub: any) {
    activeSubmodule.value = sub;
    isEditSubmoduleOpen.value = true;
}

function deleteSubmodule(sub: any) {
    requestConfirm('Delete Submodule', `Are you sure you want to delete ${sub.path}? This cannot be undone.`, true, async () => {
        try {
            await window.gitbox.deleteSubmodule(repoPath.value, sub.path);
            showToast('Success', `Submodule ${sub.path} deleted successfully.`, 'success');
            loadRepoData(true);
        } catch (e: any) {
            showToast('Error', e.message, 'error');
        }
    });
}

function addSubmodule() {
    isAddSubmoduleOpen.value = true;
}
</script>

<template>
  <div class="mb-2">
    <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer select-none group">
      <div class="flex items-center gap-1.5 flex-1 hover:text-neutral-300" @click="isCollapsed = !isCollapsed">
        <Icon :icon="isCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
        <Icon icon="lucide:package" class="text-sm" /> <span>{{ $t('common.submodules') || 'Submodules' }} ({{ filteredSubmodules.length }})</span>
      </div>
      <button @click.stop="addSubmodule()" class="p-1 hover:bg-neutral-700 rounded transition-colors group/btn" title="Add Submodule">
        <Icon icon="lucide:plus" class="text-xs group-hover/btn:text-blue-400" />
      </button>
    </div>
     
     <ul v-show="!isCollapsed" class="pb-1 mt-1">
        <li v-for="(sub, i) in filteredSubmodules" :key="sub.path" 
            @contextmenu="openSubmoduleContextMenu($event, i, sub)"
            class="pl-[16px] pr-2 py-1 flex items-center gap-2 hover:bg-neutral-800 cursor-pointer group/sub relative transition-all text-neutral-300 hover:text-white">
            <div class="w-3 flex-shrink-0 flex items-center justify-center">
               <Icon v-if="sub.status === 'uninitialized' || sub.status === 'modified' || sub.status === 'uncommitted'" icon="lucide:plus" class="text-[12px] font-bold text-green-500" title="Your submodule has been added and initialized but not committed." />
            </div>
            <Icon icon="lucide:package" class="text-xs flex-shrink-0" :class="{'text-yellow-500': sub.status === 'uninitialized', 'text-blue-500': sub.status === 'modified'}" />
            <span class="text-xs truncate flex-1 font-mono leading-tight whitespace-nowrap">{{ sub.path }}</span>
            
            <!-- Quick Action Buttons -->
            <div class="hidden group-hover/sub:flex items-center gap-1 absolute right-2 bg-gradient-to-l from-neutral-800 via-neutral-800 pl-4 py-0.5">
               <button class="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors" title="More actions" @click.stop="openSubmoduleContextMenu($event, i, sub)">
                  <Icon icon="lucide:more-vertical" class="text-[10px]" />
               </button>
            </div>
            
            <div class="absolute inset-y-0 left-0 w-[2px] bg-transparent transition-colors group-hover/sub:bg-blue-500"></div>
        </li>
     </ul>
  </div>
</template>

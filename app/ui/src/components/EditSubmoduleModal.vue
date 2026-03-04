<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import { isEditSubmoduleOpen, activeSubmodule, confirmModal, requestConfirm } from '../services/modalService';
import { repoPath, loadRepoData, activeTab } from '../services/gitService';
import { openRepository, activeWorkspaceId, workspaces } from '../services/workspaceService';
import { showToast } from '../services/toastService';

const { t } = useI18n();

const remoteUrl = ref('');
const targetPath = ref('');
const isLoading = ref(false);

watch(isEditSubmoduleOpen, async (val) => {
    if (val && activeSubmodule.value) {
        remoteUrl.value = 'Loading...';
        targetPath.value = activeSubmodule.value.path;
        try {
            const url = await window.gitbox.getRemoteUrl(repoPath.value, activeSubmodule.value.path);
            remoteUrl.value = url || 'Unknown URL';
        } catch(e) {
            remoteUrl.value = 'Unknown URL';
        }
    }
});

async function openSubmodule() {
    if (!activeSubmodule.value) return;
    const parentName = repoPath.value.split(/[/\\]/).pop() || 'Repo';
    openRepository(repoPath.value + '/' + activeSubmodule.value.path, activeSubmodule.value.path, true, parentName, repoPath.value);
    isEditSubmoduleOpen.value = false;
}

function commitChanges() {
    if (!activeSubmodule.value) return;
    openSubmodule();
    activeTab.value = 'local_changes';
}

async function updateSubmodule() {
    if (!activeSubmodule.value) return;
    isLoading.value = true;
    try {
        await window.gitbox.updateSubmodule(repoPath.value, activeSubmodule.value.path);
        showToast('Success', `Submodule ${activeSubmodule.value.path} updated successfully.`, 'success');
        loadRepoData(true);
        isEditSubmoduleOpen.value = false;
    } catch (e: any) {
        showToast('Error', e.message, 'error');
    } finally {
        isLoading.value = false;
    }
}

async function deleteSubmodule() {
    if (!activeSubmodule.value) return;
    requestConfirm('Delete Submodule', `Are you sure you want to delete ${activeSubmodule.value.path}? This cannot be undone.`, true, async () => {
        isLoading.value = true;
        try {
            await window.gitbox.deleteSubmodule(repoPath.value, activeSubmodule.value.path);
            showToast('Success', `Submodule ${activeSubmodule.value.path} deleted successfully.`, 'success');
            loadRepoData(true);
            isEditSubmoduleOpen.value = false;
        } catch (e: any) {
            showToast('Error', e.message, 'error');
        } finally {
            isLoading.value = false;
        }
    });
}
</script>

<template>
  <Modal v-model="isEditSubmoduleOpen" :title="`Edit Submodule`" icon="lucide:layers" width="550px">
    <div v-if="activeSubmodule" class="p-4 flex flex-col gap-4">
      <div class="space-y-4">
        <!-- Remote URL -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-neutral-400">Remote URL</label>
          <div class="relative bg-[#252526] border border-neutral-700 rounded overflow-hidden flex items-center">
            <input v-model="remoteUrl" disabled type="text" class="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-200 outline-none w-full opacity-70" />
          </div>
        </div>

        <!-- Name/Path -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-neutral-400">Path</label>
          <div class="relative bg-[#252526] border border-neutral-700 rounded overflow-hidden flex items-center">
            <input v-model="targetPath" disabled type="text" class="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-200 outline-none w-full opacity-70" />
          </div>
        </div>
      </div>

      <button disabled class="w-full bg-[#252526] border border-neutral-700 text-neutral-500 rounded px-4 py-2 text-xs font-medium opacity-50 cursor-not-allowed">
        Edit this submodule
      </button>

      <div v-if="activeSubmodule.status === 'uninitialized' || activeSubmodule.status === 'modified' || activeSubmodule.status === 'uncommitted'" class="flex items-center justify-center gap-2 text-green-500 text-xs font-medium">
         <Icon icon="lucide:plus" class="text-xs" />
         Your submodule has been added and initialized but not committed.
      </div>

      <div class="bg-[#2A2D31] rounded overflow-hidden text-xs border border-neutral-700 flex flex-col">
          <div class="px-3 py-2 flex items-center justify-between text-neutral-400 border-b border-neutral-700 bg-[#252526]">
              <span>Checked Out Commit</span>
              <span class="font-mono">{{ activeSubmodule.sha.substring(0, 8) }}</span>
          </div>
          <div class="flex items-center">
             <button @click="commitChanges()" class="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-4 py-3 border-r border-neutral-700 transition-colors flex items-center justify-center font-medium">
               Commit Changes
             </button>
          </div>
      </div>

      <div class="flex items-center gap-2 mt-2">
         <button @click="openSubmodule()" class="flex-1 border border-blue-600/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium transition-colors">
            <Icon icon="lucide:folder-open" /> Open this submodule
         </button>
         <button @click="deleteSubmodule()" :disabled="isLoading" class="flex-1 border border-red-900/50 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium transition-colors">
            <Icon v-if="isLoading" icon="lucide:loader-2" class="animate-spin" />
            <Icon v-else icon="lucide:trash-2" /> Delete this submodule
         </button>
      </div>
    </div>
  </Modal>
</template>

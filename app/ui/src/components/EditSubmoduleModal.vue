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
        remoteUrl.value = t('common.loading');
        targetPath.value = activeSubmodule.value.path;
        try {
            const url = await window.gitbox.getRemoteUrl(repoPath.value, activeSubmodule.value.path);
            remoteUrl.value = url || t('modal.unknown_url');
        } catch(e) {
            remoteUrl.value = t('modal.unknown_url');
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
        showToast(t('modal.success'), t('modal.submodule_updated', { path: activeSubmodule.value.path }), 'success');
        loadRepoData(true);
        isEditSubmoduleOpen.value = false;
    } catch (e: any) {
        showToast(t('modal.error'), e.message, 'error');
    } finally {
        isLoading.value = false;
    }
}

async function deleteSubmodule() {
    if (!activeSubmodule.value) return;
    requestConfirm(t('modal.delete_submodule'), t('modal.delete_submodule_confirm', { path: activeSubmodule.value.path }), true, async () => {
        isLoading.value = true;
        try {
            await window.gitbox.deleteSubmodule(repoPath.value, activeSubmodule.value.path);
            showToast(t('modal.success'), t('modal.submodule_deleted', { path: activeSubmodule.value.path }), 'success');
            loadRepoData(true);
            isEditSubmoduleOpen.value = false;
        } catch (e: any) {
            showToast(t('modal.error'), e.message, 'error');
        } finally {
            isLoading.value = false;
        }
    });
}
</script>

<template>
  <Modal v-model="isEditSubmoduleOpen" :title="t('modal.edit_submodule')" icon="lucide:layers" width="550px">
    <div v-if="activeSubmodule" class="p-4 flex flex-col gap-4">
      <div class="space-y-4">
        <!-- Remote URL -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-content-muted">{{ t('modal.remote_url') }}</label>
          <div class="relative bg-surface border border-line-strong rounded overflow-hidden flex items-center">
            <input v-model="remoteUrl" disabled type="text" class="flex-1 bg-transparent px-3 py-2 text-sm text-content outline-none w-full opacity-70" />
          </div>
        </div>

        <!-- Name/Path -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-content-muted">{{ t('modal.path') }}</label>
          <div class="relative bg-surface border border-line-strong rounded overflow-hidden flex items-center">
            <input v-model="targetPath" disabled type="text" class="flex-1 bg-transparent px-3 py-2 text-sm text-content outline-none w-full opacity-70" />
          </div>
        </div>
      </div>

      <button disabled class="w-full bg-surface border border-line-strong text-neutral-500 rounded px-4 py-2 text-xs font-medium opacity-50 cursor-not-allowed">
        {{ t('modal.edit_this_submodule') }}
      </button>

      <div v-if="activeSubmodule.status === 'uninitialized' || activeSubmodule.status === 'modified' || activeSubmodule.status === 'uncommitted'" class="flex items-center justify-center gap-2 text-green-500 text-xs font-medium">
         <Icon icon="lucide:plus" class="text-xs" />
         {{ t('modal.submodule_not_committed') }}
      </div>

      <div class="bg-surface rounded overflow-hidden text-xs border border-line-strong flex flex-col">
          <div class="px-3 py-2 flex items-center justify-between text-content-muted border-b border-line-strong bg-surface">
              <span>{{ t('modal.checked_out_commit') }}</span>
              <span class="font-mono">{{ activeSubmodule.sha.substring(0, 8) }}</span>
          </div>
          <div class="flex items-center">
             <button @click="commitChanges()" class="flex-1 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-content px-4 py-3 border-r border-line-strong transition-colors flex items-center justify-center font-medium">
               {{ t('modal.commit_changes') }}
             </button>
          </div>
      </div>

      <div class="flex items-center gap-2 mt-2">
         <button @click="openSubmodule()" class="flex-1 border border-blue-600/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium transition-colors">
            <Icon icon="lucide:folder-open" /> {{ t('modal.open_this_submodule') }}
         </button>
         <button @click="deleteSubmodule()" :disabled="isLoading" class="flex-1 border border-red-900/50 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium transition-colors">
            <Icon v-if="isLoading" icon="lucide:loader-2" class="animate-spin" />
            <Icon v-else icon="lucide:trash-2" /> {{ t('modal.delete_this_submodule') }}
         </button>
      </div>
    </div>
  </Modal>
</template>

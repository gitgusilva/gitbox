<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import { isAddSubmoduleOpen } from '../services/modalService';
import { repoPath, loadRepoData } from '../services/gitService';
import { showToast } from '../services/toastService';

const { t } = useI18n();

const remoteUrl = ref('');
const targetPath = ref('');
const isLoading = ref(false);
const error = ref('');

watch(isAddSubmoduleOpen, (val) => {
    if (val) {
        remoteUrl.value = '';
        targetPath.value = '';
        error.value = '';
    }
});

async function addSubmodule() {
    if (!remoteUrl.value) {
        error.value = t('submodule.url_required') || 'Remote URL is required.';
        return;
    }

    isLoading.value = true;
    error.value = '';

    try {
        if (!window.gitbox) throw new Error('GitBox API missing');
        await (window.gitbox as any).addSubmodule(repoPath.value, remoteUrl.value, targetPath.value);
        
        showToast(t('modal.success'), t('modal.submodule_added'), 'success');
        isAddSubmoduleOpen.value = false;
        loadRepoData(true);
    } catch (e: any) {
        error.value = e.message || t('modal.submodule_add_failed');
        showToast(t('modal.error'), error.value, 'error');
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
  <Modal v-model="isAddSubmoduleOpen" :title="t('submodule.add_title') || 'Add Submodule'" icon="lucide:package-plus" width="500px">
    <div class="p-6 flex flex-col gap-5">
      <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
         <Icon icon="lucide:alert-circle" /> <span>{{ error }}</span>
      </div>

      <div class="space-y-4">
        <!-- Remote URL -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-400">{{ t('submodule.remote_url') || 'Remote URL' }}</label>
          <div class="relative bg-neutral-100 dark:bg-[#252526] border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden flex items-center focus-within:border-blue-500 transition-colors shadow-inner">
            <input v-model="remoteUrl" :disabled="isLoading" type="text" placeholder="https://github.com/user/repo.git" class="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-600 outline-none w-full disabled:opacity-50" />
            <div class="px-3 border-l border-neutral-300 dark:border-neutral-700 text-neutral-500">
               <Icon icon="lucide:link" class="text-xs" />
            </div>
          </div>
        </div>

        <!-- Name/Path -->
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-400">{{ t('submodule.name_path') || 'Name/Path (optional)' }}</label>
          <div class="relative bg-neutral-100 dark:bg-[#252526] border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden flex items-center focus-within:border-blue-500 transition-colors shadow-inner">
            <input v-model="targetPath" :disabled="isLoading" type="text" :placeholder="t('modal.submodule_path_placeholder')" class="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-600 outline-none w-full disabled:opacity-50" />
            <div class="px-3 border-l border-neutral-300 dark:border-neutral-700 text-neutral-500">
               <Icon icon="lucide:folder" class="text-xs" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer action -->
      <div class="pt-4 border-t border-neutral-200 dark:border-neutral-800">
         <button @click="addSubmodule" :disabled="isLoading || !remoteUrl" class="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-md focus:ring-2 ring-green-500/50 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed">
            <Icon v-if="isLoading" icon="lucide:loader-2" class="animate-spin" />
            <Icon v-else icon="lucide:plus-circle" />
            {{ t('submodule.add_button') || 'Add Submodule' }}
         </button>
      </div>
    </div>
  </Modal>
</template>

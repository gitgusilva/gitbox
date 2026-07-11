<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import Modal from './Common/Modal.vue';
import { isPullModalOpen } from '../services/modalService';
import { confirmPull, currentBranchName } from '../services/gitService';

const { t } = useI18n();

function choose(mode: 'merge' | 'rebase') {
  confirmPull(mode);
}
</script>

<template>
  <Modal v-model="isPullModalOpen" :title="t('pull_modal.title')" width="520px">
    <div class="p-6">
      <p class="text-xs text-content-muted leading-relaxed mb-5"
         v-html="t('pull_modal.diverged_text', { branch: currentBranchName })"></p>
      <div class="grid grid-cols-2 gap-3">
        <button @click="choose('merge')"
                class="flex flex-col items-start gap-2 p-4 rounded-lg border border-line-strong/60 bg-surface hover:border-accent hover:bg-surface-hover transition-all text-left outline-none">
          <span class="flex items-center gap-2 text-content-strong font-semibold text-sm">
            <Icon icon="lucide:git-merge" class="text-accent" /> {{ t('pull_modal.merge') }}
          </span>
          <span class="text-[11px] text-content-muted leading-snug">{{ t('pull_modal.merge_desc') }}</span>
        </button>
        <button @click="choose('rebase')"
                class="flex flex-col items-start gap-2 p-4 rounded-lg border border-line-strong/60 bg-surface hover:border-accent hover:bg-surface-hover transition-all text-left outline-none">
          <span class="flex items-center gap-2 text-content-strong font-semibold text-sm">
            <Icon icon="lucide:git-branch-plus" class="text-accent" /> {{ t('pull_modal.rebase') }}
          </span>
          <span class="text-[11px] text-content-muted leading-snug">{{ t('pull_modal.rebase_desc') }}</span>
        </button>
      </div>
      <div class="flex justify-end mt-6">
        <button @click="isPullModalOpen = false"
                class="px-5 py-1.5 rounded bg-transparent text-content text-xs font-bold hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

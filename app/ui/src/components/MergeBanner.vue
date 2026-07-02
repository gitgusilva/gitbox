<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { repoState, status, completeMergeAction, abortMergeAction, activeTab } from '../services/gitService';
import { requestConfirm } from '../services/modalService';

const { t } = useI18n();

const isMerging = computed(() => repoState.value === 'merge');
const hasUnresolvedConflicts = computed(() =>
  status.value.some((f: any) => String(f.status || '').includes('conflicted'))
);

function onAbort() {
  requestConfirm(t('changes.abort_merge'), t('changes.abort_merge_msg'), true, () => abortMergeAction());
}

function onComplete() {
  // Jump to Local Changes so the user sees the merged result afterwards.
  activeTab.value = 'local_changes';
  completeMergeAction();
}
</script>

<template>
  <div v-if="isMerging" class="shrink-0 h-stack items-center justify-between gap-3 px-4 py-2 bg-amber-900/25 border-b border-amber-500/30">
    <div class="h-stack items-center gap-2 min-w-0">
      <Icon icon="lucide:git-merge" class="text-amber-400 shrink-0" />
      <div class="v-stack min-w-0 leading-tight">
        <span class="text-[11px] font-bold text-amber-200 uppercase tracking-wider">{{ t('changes.merge_in_progress') }}</span>
        <span class="text-[10px] text-amber-200/60 truncate">{{ t('changes.merge_resolve_hint') }}</span>
      </div>
    </div>
    <div class="h-stack items-center gap-2 shrink-0">
      <button
        @click="onAbort"
        class="h-stack items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-neutral-300 dark:border-neutral-700 bg-neutral-100/50 dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
      >
        <Icon icon="lucide:x" />
        {{ t('changes.abort_merge') }}
      </button>
      <button
        @click="onComplete"
        :disabled="hasUnresolvedConflicts"
        :class="[
          'h-stack items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors border',
          hasUnresolvedConflicts
            ? 'bg-neutral-200/70 dark:bg-neutral-800/70 border-neutral-300 dark:border-neutral-700 text-neutral-500 cursor-not-allowed'
            : 'bg-blue-700/80 hover:bg-blue-600 border-blue-400/40 text-blue-100',
        ]"
      >
        <Icon icon="lucide:check" />
        {{ t('changes.complete_merge') }}
      </button>
    </div>
  </div>
</template>

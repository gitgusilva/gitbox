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
  <div v-if="isMerging" class="shrink-0 h-stack items-center justify-between gap-3 px-4 py-2 bg-surface border-b border-line border-l-2 border-l-amber-500/60">
    <div class="h-stack items-center gap-2 min-w-0">
      <Icon icon="lucide:git-merge" class="text-amber-500 shrink-0" />
      <div class="v-stack min-w-0 leading-tight">
        <span class="text-[11px] font-bold text-content-strong uppercase tracking-wider">{{ t('changes.merge_in_progress') }}</span>
        <span class="text-[10px] text-content-muted truncate">{{ t('changes.merge_resolve_hint') }}</span>
      </div>
    </div>
    <div class="h-stack items-center gap-2 shrink-0">
      <button
        @click="onAbort"
        class="h-stack items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-line-strong bg-app text-content hover:bg-surface-hover transition-colors"
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
            ? 'bg-surface border-line-strong text-content-muted cursor-not-allowed'
            : 'bg-accent hover:bg-accent-hover border-accent/40 text-accent-fg',
        ]"
      >
        <Icon icon="lucide:check" />
        {{ t('changes.complete_merge') }}
      </button>
    </div>
  </div>
</template>

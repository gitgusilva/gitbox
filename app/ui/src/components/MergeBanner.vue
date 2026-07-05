<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { repoState, status, abortMergeAction, manualMergeAction } from '../services/gitService';
import { requestConfirm } from '../services/modalService';
import Button from './Common/Button.vue';

const { t } = useI18n();

const isMerging = computed(() => repoState.value === 'merge');
const hasUnresolvedConflicts = computed(() =>
  status.value.some((f: any) => String(f.status || '').includes('conflicted'))
);

function onAbort() {
  requestConfirm(t('changes.abort_merge'), t('changes.abort_merge_msg'), true, () => abortMergeAction());
}
</script>

<template>
  <div v-if="isMerging" class="shrink-0 h-stack items-center justify-between gap-3 px-4 py-2 bg-surface border-b border-line border-l-2 border-l-amber-500/60">
    <div class="h-stack items-center gap-2 min-w-0">
      <Icon icon="lucide:alert-triangle" class="text-amber-500 shrink-0" />
      <div class="v-stack min-w-0 leading-tight">
        <span class="text-[11px] font-bold text-content-strong uppercase tracking-wider">{{ t('changes.merge_in_progress') }}</span>
        <span class="text-[10px] text-content-muted truncate">{{ t('changes.merge_resolve_hint') }}</span>
      </div>
    </div>
    <div class="h-stack items-center gap-2 shrink-0">
      <Button variant="primary" icon="lucide:git-merge" :disabled="!hasUnresolvedConflicts" @click="manualMergeAction">
        {{ t('changes.resolve') }}
      </Button>
      <Button variant="secondary" icon="lucide:x" @click="onAbort">
        {{ t('changes.abort') }}
      </Button>
    </div>
  </div>
</template>

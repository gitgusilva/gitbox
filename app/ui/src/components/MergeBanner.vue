<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { repoState, status, abortMergeAction, manualMergeAction,
         rebaseAbortAction, rebaseSkipAction,
         cherryPickAbortAction, cherryPickSkipAction, cherryPickContinueAction } from '../services/gitService';
import { requestConfirm } from '../services/modalService';
import Button from './Common/Button.vue';

const { t } = useI18n();

const isMerging = computed(() => repoState.value === 'merge');
const isRebasing = computed(() => repoState.value === 'rebase');
const isCherryPicking = computed(() => repoState.value === 'cherrypick');
const hasUnresolvedConflicts = computed(() =>
  status.value.some((f: any) => String(f.status || '').includes('conflicted'))
);

function onAbort() {
  requestConfirm(t('changes.abort_merge'), t('changes.abort_merge_msg'), true, () => abortMergeAction());
}

function onRebaseAbort() {
  requestConfirm(t('changes.abort_rebase'), t('changes.abort_rebase_msg'), true, () => rebaseAbortAction());
}

function onCherryPickAbort() {
  requestConfirm(t('changes.abort_cherrypick'), t('changes.abort_cherrypick_msg'), true, () => cherryPickAbortAction());
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

  <!-- Rebase in progress -->
  <div v-else-if="isRebasing" class="shrink-0 h-stack items-center justify-between gap-3 px-4 py-2 bg-surface border-b border-line border-l-2 border-l-amber-500/60">
    <div class="h-stack items-center gap-2 min-w-0">
      <Icon icon="lucide:git-branch" class="text-amber-500 shrink-0" />
      <div class="v-stack min-w-0 leading-tight">
        <span class="text-[11px] font-bold text-content-strong uppercase tracking-wider">{{ t('changes.rebase_in_progress') }}</span>
        <span class="text-[10px] text-content-muted truncate">{{ hasUnresolvedConflicts ? t('changes.rebase_resolve_hint') : t('changes.rebase_continue_hint') }}</span>
      </div>
    </div>
    <div class="h-stack items-center gap-2 shrink-0">
      <!-- No manual "Continue": the rebase auto-advances once conflicts are resolved. -->
      <Button variant="secondary" icon="lucide:skip-forward" @click="rebaseSkipAction">
        {{ t('changes.skip') }}
      </Button>
      <Button variant="secondary" icon="lucide:x" @click="onRebaseAbort">
        {{ t('changes.abort') }}
      </Button>
    </div>
  </div>

  <!-- Cherry-pick in progress -->
  <div v-else-if="isCherryPicking" class="shrink-0 h-stack items-center justify-between gap-3 px-4 py-2 bg-surface border-b border-line border-l-2 border-l-amber-500/60">
    <div class="h-stack items-center gap-2 min-w-0">
      <Icon icon="lucide:git-cherry" class="text-amber-500 shrink-0" />
      <div class="v-stack min-w-0 leading-tight">
        <span class="text-[11px] font-bold text-content-strong uppercase tracking-wider">{{ t('changes.cherrypick_in_progress') }}</span>
        <span class="text-[10px] text-content-muted truncate">{{ hasUnresolvedConflicts ? t('changes.cherrypick_resolve_hint') : t('changes.cherrypick_continue_hint') }}</span>
      </div>
    </div>
    <div class="h-stack items-center gap-2 shrink-0">
      <Button v-if="hasUnresolvedConflicts" variant="primary" icon="lucide:git-merge" @click="manualMergeAction">
        {{ t('changes.resolve') }}
      </Button>
      <Button v-else variant="primary" icon="lucide:check" @click="cherryPickContinueAction">
        {{ t('changes.continue') }}
      </Button>
      <Button variant="secondary" icon="lucide:skip-forward" @click="cherryPickSkipAction">
        {{ t('changes.skip') }}
      </Button>
      <Button variant="secondary" icon="lucide:x" @click="onCherryPickAbort">
        {{ t('changes.abort') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { 
  activeTab, 
  log, 
  selectedCommit, 
  unstagedFiles, 
  stagedFiles, 
  stashes,
  error,
  errorRemedy
} from '../services/gitService';
import HistoryView from './History/HistoryView.vue';
import ChangesView from './Changes/ChangesView.vue';
import StashView from './Stashes/StashView.vue';
import FilesView from './Files/FilesView.vue';
import PullRequestView from '../components/PullRequestView.vue';
import OutputLogView from './OutputLogView.vue';
import StatisticsView from './StatisticsView.vue';
import MergeBanner from '../components/MergeBanner.vue';
import { Icon } from '@iconify/vue';
import { showToast } from '../services/toastService';
import { useI18n } from 'vue-i18n';
import Tooltip from '../components/Common/Tooltip.vue';

const { t } = useI18n();

function copyError() {
    if (error.value) {
        navigator.clipboard.writeText(error.value);
        showToast('Success', t('common.copy') || 'Copied to clipboard', 'success');
    }
}

/** Copies the suggested fix so the user can paste it into their own terminal.
 *  The app never runs it — see `errorRemedy` for why. */
function copyRemedy() {
    const remedy = errorRemedy.value;
    if (!remedy) return;
    navigator.clipboard.writeText(remedy.command);
    showToast('Success', t('common.copy') || 'Copied to clipboard', 'success');
}

</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-app">
    <!-- Global error banner: themed (removed/red token). The message truncates so a
         long error never runs under the copy button; the button stays pinned right. -->
    <div v-if="error" class="shrink-0 h-stack items-center gap-2 px-3 py-2 bg-removed/15 border-b border-removed/40 text-xs overflow-hidden">
       <Icon icon="lucide:alert-circle" class="text-removed shrink-0 text-sm" />
       <div class="flex-1 min-w-0 truncate text-content-strong">{{ error }}</div>
       <Tooltip :text="t('common.copy') || 'Copy'" position="left">
         <button @click="copyError" class="shrink-0 p-1 rounded text-removed hover:text-content-strong hover:bg-removed/25 transition-colors">
             <Icon icon="lucide:copy" class="text-sm" />
         </button>
       </Tooltip>
       <button @click="error = ''" class="shrink-0 p-1 rounded text-removed hover:text-content-strong hover:bg-removed/25 transition-colors">
         <Icon icon="lucide:x" class="text-sm" />
       </button>
    </div>

    <!-- Ownership failures are the one class of error with a known, mechanical
         fix that GitBox cannot apply itself (it needs privileges, on files a
         container usually owns). Hand over the exact command instead. -->
    <div v-if="error && errorRemedy" class="shrink-0 px-3 py-2 bg-surface border-b border-removed/40 text-xs v-stack gap-1.5">
      <div class="text-content-strong">{{ errorRemedy.title }}</div>
      <div class="h-stack items-center gap-2">
        <code class="flex-1 min-w-0 truncate px-2 py-1 rounded bg-app text-content font-mono select-all">{{ errorRemedy.command }}</code>
        <button @click="copyRemedy" class="shrink-0 h-stack items-center gap-1 px-2 py-1 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors">
          <Icon icon="lucide:copy" class="text-sm" />
          <span>{{ t('common.copy') || 'Copy' }}</span>
        </button>
      </div>
      <div class="text-content-muted">{{ errorRemedy.note }}</div>
    </div>

    <!-- Merge-in-progress banner: shown on every tab while a merge is active. -->
    <MergeBanner />

    <HistoryView v-if="activeTab === 'history'" />
    <ChangesView v-else-if="activeTab === 'local_changes'" />
    <StashView v-else-if="activeTab === 'stashes'" />
    <FilesView v-else-if="activeTab === 'files'" />
    <PullRequestView v-else-if="activeTab === 'pull_request'" />
    <OutputLogView v-else-if="activeTab === 'output_log'" />
    <StatisticsView v-else-if="activeTab === 'statistics'" />
  </div>
</template>

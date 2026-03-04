<script setup lang="ts">
import { computed } from 'vue';
import { 
  activeTab, 
  log, 
  selectedCommit, 
  unstagedFiles, 
  stagedFiles, 
  stashes, 
  error 
} from '../services/gitService';
import HistoryView from './History/HistoryView.vue';
import ChangesView from './Changes/ChangesView.vue';
import StashView from './Stashes/StashView.vue';
import FilesView from './Files/FilesView.vue';
import ChangelogView from './ChangelogView.vue';
import PullRequestView from '../components/PullRequestView.vue';
import { Icon } from '@iconify/vue';
import { showToast } from '../services/toastService';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

function copyError() {
    if (error.value) {
        navigator.clipboard.writeText(error.value);
        showToast('Success', t('common.copy') || 'Copied to clipboard', 'success');
    }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-[#1E1E1E]">
    <div v-if="error" class="bg-red-900/50 border-b border-red-800 text-red-100 text-xs p-2 flex items-center justify-between group">
       <div class="truncate flex-1">{{ error }}</div>
       <button @click="copyError" :title="t('common.copy') || 'Copy'" class="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-800 rounded transition-colors text-red-300 hover:text-white ml-2">
           <Icon icon="lucide:copy" />
       </button>
    </div>
    
    <HistoryView v-if="activeTab === 'history'" />
    <ChangesView v-else-if="activeTab === 'local_changes'" />
    <StashView v-else-if="activeTab === 'stashes'" />
    <FilesView v-else-if="activeTab === 'files'" />
    <ChangelogView v-else-if="activeTab === 'changelog'" version="1.0.0" />
    <PullRequestView v-else-if="activeTab === 'pull_request'" />
  </div>
</template>

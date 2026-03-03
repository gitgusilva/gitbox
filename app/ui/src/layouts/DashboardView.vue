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
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-[#1E1E1E]">
    <div v-if="error" class="bg-red-900/50 border-b border-red-800 text-red-100 text-xs p-2 truncate">{{ error }}</div>
    
    <HistoryView v-if="activeTab === 'history'" />
    <ChangesView v-else-if="activeTab === 'local_changes'" />
    <StashView v-else-if="activeTab === 'stashes'" />
    <FilesView v-else-if="activeTab === 'files'" />
    <ChangelogView v-else-if="activeTab === 'changelog'" version="1.0.0" />
    <PullRequestView v-else-if="activeTab === 'pull_request'" />
  </div>
</template>

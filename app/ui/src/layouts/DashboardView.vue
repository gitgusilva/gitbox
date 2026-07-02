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
import OutputLogView from './OutputLogView.vue';
import MergeBanner from '../components/MergeBanner.vue';
import { appVersion } from '../services/versionService';
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

function startMarquee(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement;
  const textEl = container.querySelector('.truncate') as HTMLElement;
  if (textEl && textEl.scrollWidth > textEl.clientWidth) {
    const distance = textEl.scrollWidth - textEl.clientWidth + 20;
    textEl.style.textOverflow = 'clip';
    textEl.style.overflow = 'visible';
    textEl.style.transitionProperty = 'transform';
    textEl.style.transitionTimingFunction = 'linear';
    textEl.style.transitionDuration = `${Math.max(1000, distance * 20)}ms`;
    textEl.style.transform = `translateX(-${distance}px)`;
  }
}

function stopMarquee(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement;
  const textEl = container.querySelector('.truncate') as HTMLElement;
  if (textEl) {
    textEl.style.transitionDuration = '200ms';
    textEl.style.transform = 'translateX(0)';
    setTimeout(() => {
        textEl.style.textOverflow = '';
        textEl.style.overflow = '';
    }, 200);
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#1E1E1E]">
    <div v-if="error" class="bg-red-900/50 border-b border-red-800 text-red-100 text-xs p-2 flex items-center justify-between group overflow-hidden" @mouseenter="startMarquee" @mouseleave="stopMarquee">
       <div class="truncate flex-1 relative z-0 transition-transform">{{ error }}</div>
       <Tooltip :text="t('common.copy') || 'Copy'" position="left">
         <button @click="copyError" class="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-800 rounded transition-colors text-red-300 hover:text-white ml-2 relative z-10 bg-red-900/50 backdrop-blur">
             <Icon icon="lucide:copy" />
         </button>
       </Tooltip>
    </div>

    <!-- Merge-in-progress banner: shown on every tab while a merge is active. -->
    <MergeBanner />

    <HistoryView v-if="activeTab === 'history'" />
    <ChangesView v-else-if="activeTab === 'local_changes'" />
    <StashView v-else-if="activeTab === 'stashes'" />
    <FilesView v-else-if="activeTab === 'files'" />
    <ChangelogView v-else-if="activeTab === 'changelog'" :version="appVersion" />
    <PullRequestView v-else-if="activeTab === 'pull_request'" />
    <OutputLogView v-else-if="activeTab === 'output_log'" />
  </div>
</template>

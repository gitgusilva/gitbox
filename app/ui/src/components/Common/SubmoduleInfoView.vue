<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import CommitInfoView from './CommitInfoView.vue';
import { repoPath } from '../../services/gitService';
import { cn } from '../../utils/cn';

/**
 * Component to display information about a Git submodule.
 * Fetches the commit data for a specific SHA within the submodule path.
 */
const props = defineProps<{
  /** Relative path to the submodule in the main repository. */
  path: string;
  /** The specific commit SHA to inspect in the submodule. */
  sha: string;
  /** Custom CSS class for the root container. */
  class?: string;
}>();

const { t } = useI18n();

const submoduleCommitInfo = ref<any>(null);
const isSubmoduleLoading = ref(false);

/**
 * Watch for path or SHA changes to refresh submodule commit data.
 */
watch(() => [props.path, props.sha], async ([newPath, newSha]) => {
  if (newPath && newSha) {
    submoduleCommitInfo.value = null;
    isSubmoduleLoading.value = true;
    try {
      submoduleCommitInfo.value = await window.gitbox.getSubmoduleCommitInfo(repoPath.value, newPath, newSha);
    } catch (e) {
      console.error('Failed to load submodule info', e);
    } finally {
      isSubmoduleLoading.value = false;
    }
  } else {
    submoduleCommitInfo.value = null;
  }
}, { immediate: true });
</script>

<template>
  <div :class="cn('h-full v-stack min-h-0 bg-surface animate-in fade-in slide-in-from-right-2 duration-300', props.class)">
    <!-- Submodule Header Panel -->
    <header class="p-6 border-b border-line bg-surface h-stack justify-between shrink-0">
       <div class="h-stack gap-4">
         <div class="w-10 h-10 rounded-lg bg-blue-600/10 center border border-blue-500/20 shadow-lg shadow-blue-900/10">
           <Icon icon="lucide:box" class="text-2xl text-blue-500" />
         </div>
         <div class="v-stack gap-0.5">
           <div class="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500">{{ t('history_detail.submodule') }}</div>
           <h2 class="text-sm font-bold text-content-strong break-all select-text font-mono leading-tight">{{ path }}</h2>
         </div>
       </div>
       
       <div v-if="sha" class="v-stack items-end gap-1">
          <div class="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">{{ t('history_detail.revision') }}</div>
          <div class="px-2 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded text-[10px] font-mono text-content-muted border border-line-strong select-text">{{ sha.substring(0, 8) }}</div>
       </div>
    </header>

    <!-- Submodule Content -->
    <div class="flex-1 overflow-hidden relative">
       <div v-if="isSubmoduleLoading" class="absolute inset-0 v-stack center bg-surface z-10">
          <Icon icon="lucide:loader-2" class="animate-spin text-5xl text-blue-500/20" />
          <div class="mt-4 text-[10px] uppercase font-black tracking-widest text-neutral-600 animate-pulse">{{ t('history_detail.loading_commit_data') }}</div>
       </div>
       
       <template v-else-if="submoduleCommitInfo">
           <CommitInfoView 
                        :commit="{
                          id: submoduleCommitInfo.sha,
                          author: submoduleCommitInfo.authorName,
                          authorEmail: submoduleCommitInfo.authorEmail,
                          timestamp: submoduleCommitInfo.authorTime,
                          committer: submoduleCommitInfo.committerName,
                          committerEmail: submoduleCommitInfo.committerEmail,
                          committerTimestamp: submoduleCommitInfo.committerTime,
                          summary: submoduleCommitInfo.message.split('\n')[0],
                          message: submoduleCommitInfo.message,
                          parents: submoduleCommitInfo.parents.map((p: string) => ({ id: p }))
                        }" 
                        :commitRefs="submoduleCommitInfo.refs.map((r: string) => ({ name: r, type: r.includes('/') ? 'remote' : 'branch' }))"
                        :changedFiles="[]"
                        :showFiles="false" />
       </template>
       
       <div v-else class="flex-1 h-full center v-stack text-neutral-600 p-8 bg-surface">
          <div class="relative mb-6">
            <Icon icon="lucide:alert-circle" class="text-7xl opacity-5" />
            <Icon icon="lucide:box" class="absolute inset-0 m-auto text-3xl opacity-10" />
          </div>
          <div class="font-bold uppercase tracking-[0.2em] text-sm opacity-20">{{ t('history_detail.submodule_not_retrieved') }}</div>
          <div class="text-[10px] opacity-30 mt-3 max-w-xs text-center leading-relaxed">{{ t('history_detail.submodule_init_hint') }}</div>
       </div>
    </div>
  </div>
</template>

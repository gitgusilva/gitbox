<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { 
  pullRequests, 
  isPRLoading, 
  createPullRequest, 
  prError, 
  currentUserLogin
} from '../../../services/pullRequestService';
import { activePullRequest } from '../../../services/modalService';
import { activeTab } from '../../../services/gitService';

const props = defineProps<{
  branchFilter: string;
}>();

const { t } = useI18n();
const prsCollapsed = ref(true);

const prGroupsCollapsed = ref<Record<string, boolean>>({
   my: true,
   assigned: true,
   review: true,
   all: true
});

const prs = computed(() => {
  if (!props.branchFilter) return pullRequests.value;
  return pullRequests.value.filter(pr => 
    pr.title.toLowerCase().includes(props.branchFilter.toLowerCase()) ||
    pr.sourceBranch.toLowerCase().includes(props.branchFilter.toLowerCase())
  );
});

const myPRs = computed(() => prs.value.filter(pr => pr.user.login === currentUserLogin.value));
const assignedPRs = computed(() => prs.value.filter(pr => pr.assignees?.some(a => a.login === currentUserLogin.value)));
const reviewPRs = computed(() => prs.value.filter(pr => pr.requestedReviewers?.some(a => a.login === currentUserLogin.value)));
const allPRs = computed(() => prs.value);

const prGroups = computed(() => [
   { id: 'my', title: t('prs.my_prs'), list: myPRs.value },
   { id: 'assigned', title: t('prs.assigned_to_me'), list: assignedPRs.value },
   { id: 'review', title: t('prs.awaiting_review'), list: reviewPRs.value },
   { id: 'all', title: t('prs.all_prs'), list: allPRs.value }
]);

function openPullRequest(pr: any) {
    activePullRequest.value = pr;
    activeTab.value = 'pull_request';
}
</script>

<template>
  <div class="mb-2">
    <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer select-none group">
      <div class="flex items-center gap-1.5 flex-1 hover:text-neutral-300" @click="prsCollapsed = !prsCollapsed">
        <Icon :icon="prsCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
        <Icon icon="lucide:git-pull-request" class="text-sm" /> <span>{{ t('common.prs') }} ({{ prs.length }})</span>
      </div>
      <button @click.stop="createPullRequest()" class="p-1 hover:bg-neutral-700 rounded transition-colors group/btn" title="Create Pull Request">
        <Icon icon="lucide:plus" class="text-xs group-hover/btn:text-blue-400" />
      </button>
    </div>
    
    <div v-show="!prsCollapsed" class="pb-1 mt-1">
      <div v-if="isPRLoading && prs.length === 0" class="px-8 py-2 text-[10px] text-neutral-500 animate-pulse flex items-center gap-2">
        <Icon icon="lucide:loader-2" class="animate-spin" /> {{ t('common.loading') }}...
      </div>
      
      <template v-for="group in prGroups" :key="group.id">
          <div class="pl-[22px] pr-2 py-1 flex items-center gap-1.5 text-[11px] text-neutral-400 cursor-pointer select-none group/cat hover:text-white"
               @click="prGroupsCollapsed[group.id] = !prGroupsCollapsed[group.id]">
            <Icon :icon="prGroupsCollapsed[group.id] ? 'lucide:chevron-right' : 'lucide:chevron-down'" class="text-[10px]" />
            <span class="truncate flex-1">{{ group.title }} ({{ group.list.length }})</span>
          </div>
          
          <ul v-show="!prGroupsCollapsed[group.id]" class="mb-2">
              <li v-if="group.list.length === 0" class="pl-[34px] pr-2 py-1 text-[10px] text-neutral-600 italic">
                  {{ t('common.empty') }}
              </li>
              <li v-for="pr in group.list" :key="pr.id" 
                  @click="openPullRequest(pr)"
                  class="pl-[34px] pr-2 py-1.5 flex flex-col gap-0.5 hover:bg-neutral-800 cursor-pointer group/pr border-l-2 border-transparent hover:border-blue-500 transition-all">
                 <div class="flex items-start gap-2">
                   <Icon :icon="pr.state === 'open' ? 'lucide:git-pull-request' : 'lucide:git-pull-request-closed'" 
                         :class="pr.state === 'open' ? 'text-green-500' : 'text-purple-500'" 
                         class="text-xs mt-0.5" />
                   <div class="flex-1 min-w-0">
                     <div class="text-[11px] text-neutral-200 font-medium truncate group-hover/pr:text-blue-400 transition-colors">
                       <span class="text-neutral-500 font-mono">#{{ pr.number }}</span> {{ pr.title }}
                     </div>
                     <div class="flex items-center gap-1.5 mt-0.5">
                       <img :src="pr.user.avatar_url" class="w-3 h-3 rounded-full opacity-80" />
                       <span class="text-[9px] text-neutral-500 font-medium">{{ pr.user.login }}</span>
                       <span class="text-[9px] text-neutral-400 flex items-center gap-1">
                         <Icon icon="lucide:arrow-right" class="text-[8px]" />
                         {{ pr.targetBranch }}
                       </span>
                     </div>
                   </div>
                 </div>
              </li>
          </ul>
      </template>

      <div v-if="!isPRLoading && prError === 'github_404'" class="px-4 py-3 text-[10px] text-yellow-500/90 leading-relaxed bg-yellow-500/10 border border-yellow-500/20 m-2 rounded-lg">
        <div class="flex items-start gap-2">
          <Icon icon="lucide:alert-triangle" class="text-sm shrink-0 mt-0.5" />
          <span>{{ t('common.github_pr_404') }}</span>
        </div>
      </div>
      
    </div>
  </div>
</template>

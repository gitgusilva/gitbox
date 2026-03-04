<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { activePullRequest } from '../services/modalService';
import { activeTab } from '../services/gitService';
import { 
    closePullRequest, 
    updatePullRequest, 
    fetchPullRequestComments, 
    addPullRequestComment,
    fetchPullRequestMetadata,
    updatePullRequestReviewers,
    updatePullRequestAssigneesAndLabels,
    currentUserLogin,
    loadPullRequests,
    fetchPullRequestDetails,
    convertPullRequestToDraft
} from '../services/pullRequestService';
import { showToast } from '../services/toastService';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import MultiSelect from './Common/MultiSelect.vue';
import { formatFullDate, formatDate } from '../utils/formatters';
import { generalSettings } from '../services/settingsService';

const { t } = useI18n();
const isClosing = ref(false);
const isReopening = ref(false);
const isConvertingDraft = ref(false);

const isReviewer = computed(() => {
    if (!pr.value || !currentUserLogin.value) return false;
    const login = currentUserLogin.value;
    const isAssignee = pr.value.assignees?.some((a: any) => a.login === login);
    const isRequested = pr.value.requestedReviewers?.some((a: any) => a.login === login);
    return isAssignee || isRequested;
});

const isEditingTitle = ref(false);
const editableTitle = ref('');
const isSavingTitle = ref(false);

const isEditingDescription = ref(false);
const editableDescription = ref('');
const isSavingDescription = ref(false);

const comments = ref<any[]>([]);
const newComment = ref('');
const isLoadingComments = ref(false);
const isSubmittingComment = ref(false);

const availableUsers = ref<any[]>([]);
const availableLabels = ref<any[]>([]);

const selectedAssignees = ref<string[]>([]);
const selectedReviewers = ref<string[]>([]);
const selectedLabels = ref<string[]>([]);

const userOptions = computed(() => {
    return availableUsers.value.map(u => ({
        value: u.login,
        label: u.login,
        iconUrl: u.avatar_url
    }));
});

const reviewerOptions = computed(() => {
    return availableUsers.value
        .filter(u => u.login !== pr.value?.user?.login)
        .map(u => ({
            value: u.login,
            label: u.login,
            iconUrl: u.avatar_url
        }));
});

const labelOptions = computed(() => {
    return availableLabels.value.map(l => ({
        value: l.name,
        label: l.name,
        color: l.color
    }));
});

let cancelWatchAssignees: any;
let cancelWatchReviewers: any;

function close() {
    activePullRequest.value = null;
    activeTab.value = 'history';
}

async function handleClosePR() {
    if (!pr.value || isClosing.value) return;
    
    isClosing.value = true;
    const success = await closePullRequest(pr.value);
    isClosing.value = false;
    
    if (success) {
        close();
    }
}

function openExternal(url: string) {
    if (window.gitbox?.openExternal && url) {
        window.gitbox.openExternal(url);
    }
}

function renderMd(text: string) {
    if (!text) return '';
    return DOMPurify.sanitize(marked.parse(text) as string);
}

function handleMarkdownClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const a = target.closest('a');
    if (a && a.href) {
        event.preventDefault();
        openExternal(a.href);
    }
}

const pr = computed(() => activePullRequest.value);

watch(pr, async (newPr) => {
    if (newPr) {
        editableTitle.value = newPr.title || '';
        editableDescription.value = newPr.body || '';
        selectedAssignees.value = newPr.assignees?.map((a: any) => a.login) || [];
        selectedReviewers.value = newPr.requestedReviewers?.map((r: any) => r.login) || [];
        selectedLabels.value = newPr.labels?.map((l: any) => l.name) || [];
        
        loadComments();
        
        fetchPullRequestDetails(newPr.number).then(details => {
            if (details && activePullRequest.value && activePullRequest.value.number === newPr.number) {
                activePullRequest.value.changed_files = details.changed_files;
            }
        });
        
        if (availableUsers.value.length === 0) {
            const meta = await fetchPullRequestMetadata();
            availableUsers.value = meta.users;
            availableLabels.value = meta.labels;
        }
        
        if (cancelWatchAssignees) cancelWatchAssignees();
        if (cancelWatchReviewers) cancelWatchReviewers();
        
        cancelWatchAssignees = watch([selectedAssignees, selectedLabels], async (newVals, oldVals) => {
            if (JSON.stringify(newVals) !== JSON.stringify(oldVals)) {
                await updatePullRequestAssigneesAndLabels(newPr, selectedAssignees.value, selectedLabels.value);
            }
        }, { deep: true });
        
        cancelWatchReviewers = watch(selectedReviewers, async (newVal, oldVal) => {
             if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
                 await updatePullRequestReviewers(newPr, selectedReviewers.value);
             }
        }, { deep: true });
    }
}, { immediate: true });

async function saveTitle() {
    if (!pr.value || isSavingTitle.value || !editableTitle.value.trim()) return;
    isSavingTitle.value = true;
    await updatePullRequest(pr.value, { title: editableTitle.value.trim() });
    isSavingTitle.value = false;
    isEditingTitle.value = false;
}

async function saveDescription() {
    if (!pr.value || isSavingDescription.value) return;
    isSavingDescription.value = true;
    await updatePullRequest(pr.value, { body: editableDescription.value.trim() });
    isSavingDescription.value = false;
    isEditingDescription.value = false;
}

async function loadComments() {
    if (!pr.value) return;
    isLoadingComments.value = true;
    comments.value = await fetchPullRequestComments(pr.value);
    isLoadingComments.value = false;
}

async function submitComment() {
    if (!pr.value || isSubmittingComment.value || !newComment.value.trim()) return;
    isSubmittingComment.value = true;
    const success = await addPullRequestComment(pr.value, newComment.value.trim());
    isSubmittingComment.value = false;
    if (success) {
        newComment.value = '';
        loadComments();
    }
}

async function handleReopenPR() {
    if (!pr.value || isReopening.value) return;
    isReopening.value = true;
    const success = await updatePullRequest(pr.value, { state: 'open' });
    isReopening.value = false;
    if (success) {
        showToast('Success', 'Pull Request reopened.', 'success');
        loadPullRequests();
        close();
    }
}

async function handleConvertToDraft() {
    if (!pr.value || isConvertingDraft.value) return;
    isConvertingDraft.value = true;
    const success = await convertPullRequestToDraft(pr.value);
    isConvertingDraft.value = false;
    if (success) {
        pr.value.draft = true;
        showToast('Success', 'Converted to draft.', 'success');
    } else {
        showToast('Error', 'Failed to convert to draft.', 'error');
    }
}

</script>

<template>
  <div v-if="pr" class="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#1E1E1E] animate-in fade-in duration-300">
    <!-- Header -->
    <header class="bg-[#252526] border-b border-neutral-800 flex items-center justify-between px-4 py-2 flex-shrink-0">
      <div class="flex items-center gap-2 text-neutral-300 font-medium">
        <Icon icon="mdi:github" class="text-xl" />
        <span class="text-sm">GitHub Pull Request</span>
      </div>
      <div class="flex items-center gap-2">
        <button @click="openExternal(pr.url)" class="text-neutral-400 hover:text-white transition-colors p-1 rounded hover:bg-neutral-800" title="Open in Browser">
          <Icon icon="lucide:external-link" class="text-sm" />
        </button>
        <button @click="close" class="text-neutral-500 hover:text-neutral-300 transition-colors outline-none" title="Close">
          <Icon icon="lucide:x" class="text-lg" />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden p-6 relative">
      <div class="max-w-[1200px] mx-auto w-full flex flex-col gap-6 font-sans">
        
        <!-- PR Title Header -->
        <div class="flex flex-col gap-3 pb-6 border-b border-neutral-800">
           <div class="text-xs text-neutral-500 font-mono">#{{ pr.number }}</div>
           <h1 class="text-2xl text-white font-medium flex items-center gap-3 w-full">
             <template v-if="!isEditingTitle">
                <span class="break-words">{{ pr.title }}</span>
                <button @click="isEditingTitle = true" class="text-neutral-500 hover:text-white p-1 opacity-0 hover:opacity-100 transition-opacity">
                  <Icon icon="lucide:edit-2" class="text-sm" />
                </button>
             </template>
             <template v-else>
                <div class="flex items-center gap-2 w-full my-1">
                    <input v-model="editableTitle" @keyup.enter="saveTitle" :disabled="isSavingTitle" class="flex-1 bg-black/50 border border-neutral-700/80 rounded px-3 py-1.5 text-white text-xl focus:border-blue-500 outline-none w-full shadow-inner" />
                    <button @click="saveTitle" :disabled="isSavingTitle" class="bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2">
                       <Icon v-if="isSavingTitle" icon="lucide:loader-2" class="animate-spin" />
                       Save
                    </button>
                    <button @click="isEditingTitle = false; editableTitle = pr.title" class="text-neutral-400 hover:text-white px-3 py-1.5 rounded text-sm transition-colors hover:bg-neutral-800 shrink-0">Cancel</button>
                </div>
             </template>
           </h1>
           <div class="flex items-center gap-3 text-sm text-neutral-400">
             <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 transition-colors capitalize"
                  :class="pr.state === 'closed' ? 'bg-red-900/40 text-red-400 ring-red-500/50' : (pr.draft ? 'bg-neutral-800 text-neutral-400 ring-neutral-600/50' : 'bg-green-900/40 text-green-400 ring-green-500/50')">
                {{ pr.state === 'closed' ? pr.state : (pr.draft ? $t('pr_view.draft') || 'Draft' : pr.state) }}
             </div>
             <div class="flex items-center gap-2">
                <img :src="pr.user?.avatar_url" class="w-5 h-5 rounded-full" />
                <span class="font-bold text-neutral-200">{{ pr.user?.login }}</span>
                <span>wants to merge <span class="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-mono text-xs">{{ pr.sourceBranch }}</span> into <span class="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-mono text-xs">{{ pr.targetBranch }}</span></span>
             </div>
           </div>
        </div>

        <!-- 2 Column Layout -->
        <div class="flex flex-col md:flex-row gap-8">
           <!-- Left Column -->
           <div class="flex-1 flex flex-col gap-6 min-w-0">
             
             <!-- Description Area -->
             <div class="flex flex-col gap-2 relative group/desc">
                <div class="flex items-center justify-between text-xs font-medium text-neutral-300">
                   {{ $t('settings.create_pr.description') || 'Description' }}
                   <button v-if="!isEditingDescription" @click="isEditingDescription = true" class="text-neutral-500 hover:text-white opacity-0 group-hover/desc:opacity-100 transition-opacity"><Icon icon="lucide:edit-2" /></button>
                </div>
                <!-- Markdown Content -->
                <div v-if="!isEditingDescription" class="bg-[#1E1E1E] text-neutral-300 prose prose-invert prose-sm max-w-none prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-a:underline prose-a:underline-offset-2 p-4 rounded-lg border border-neutral-800" @click="handleMarkdownClick">
                   <div v-if="pr.body" v-html="renderMd(pr.body)"></div>
                   <div v-else class="text-neutral-500 italic">{{ $t('pr_view.no_description') || 'No description provided.' }}</div>
                </div>
                <!-- Edit Mode -->
                <div v-else class="flex flex-col gap-2">
                    <textarea v-model="editableDescription" :disabled="isSavingDescription" class="w-full min-h-[150px] bg-black/50 border border-neutral-700 rounded-lg p-3 text-sm text-neutral-200 focus:border-blue-500 outline-none resize-y font-mono shadow-inner"></textarea>
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <button @click="isEditingDescription = false; editableDescription = pr.body || ''" class="text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors px-3 py-1.5 text-xs font-medium">{{ $t('common.cancel') }}</button>
                        <button @click="saveDescription" :disabled="isSavingDescription" class="bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-1.5 text-xs font-medium flex items-center gap-2 transition-colors focus:ring-2 ring-blue-500/50">
                            <Icon v-if="isSavingDescription" icon="lucide:loader-2" class="animate-spin" />
                            {{ $t('pr_view.save') || 'Save' }}
                        </button>
                    </div>
                </div>
             </div>
             
             <!-- Comments Area -->
             <div class="flex flex-col gap-4 mt-6">
                <div class="flex items-center justify-between text-xs font-medium text-neutral-300">
                   {{ $t('pr_view.comments') || 'Comments' }}
                   <button @click="loadComments" class="text-neutral-500 hover:text-white" :class="{'animate-spin text-blue-500': isLoadingComments}"><Icon icon="lucide:refresh-cw" /></button>
                </div>
                
                <div v-if="comments.length === 0 && !isLoadingComments" class="text-xs text-neutral-600 italic">{{ $t('pr_view.no_comments') || 'No comments yet.' }}</div>
                
                <!-- Comments List -->
                <div class="relative flex flex-col gap-6">
                   <!-- Vertical connection line -->
                   <div v-if="comments.length > 0" class="absolute left-[15px] top-6 bottom-8 w-[2px] bg-neutral-800 z-0 rounded-full"></div>
                   
                   <div v-for="comment in comments" :key="comment.id" class="flex items-start gap-3 relative z-10">
                      <img :src="comment.user?.avatar_url" class="w-8 h-8 rounded-full border-2 border-neutral-800 bg-[#1E1E1E] flex-shrink-0" :title="comment.user?.login" />
                      <div class="flex-1 bg-[#252526] rounded-lg border border-neutral-800 overflow-hidden">
                         <div class="bg-neutral-800/50 px-3 py-2 border-b border-neutral-800 text-xs flex items-center justify-between group">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-neutral-200">{{ comment.user?.login }}</span>
                                <span class="text-neutral-500">{{ formatDate(comment.createdAt) }}</span>
                            </div>
                            <button @click="openExternal(comment.url)" class="text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Open in Browser"><Icon icon="lucide:external-link" /></button>
                         </div>
                         <div class="p-4 text-sm text-neutral-300 prose prose-invert prose-sm max-w-none prose-a:text-blue-400 hover:prose-a:text-blue-300 prose-a:underline prose-a:underline-offset-2" v-html="renderMd(comment.body)" @click="handleMarkdownClick">
                         </div>
                      </div>
                   </div>
                </div>

                <!-- Add Comment Input Box -->
                <div class="flex gap-3 mt-4 relative z-10 w-full">
                  <div class="flex-1 bg-[#252526] border border-neutral-700 focus-within:border-blue-500 rounded-lg overflow-hidden transition-colors flex flex-col shadow-inner">
                     <textarea v-model="newComment" :disabled="isSubmittingComment" class="w-full bg-transparent border-none outline-none resize-none min-h-[80px] p-3 text-sm text-neutral-200 placeholder:text-neutral-600 disabled:opacity-50" :placeholder="$t('pr_view.add_comment') || 'Add a comment...'"></textarea>
                     <div class="bg-[#2D2D2D]/60 border-t border-neutral-800/50 p-2 flex justify-end gap-2">
                        <button @click="submitComment" :disabled="isSubmittingComment || !newComment.trim()" class="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded font-medium text-xs transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2 focus:ring-2 ring-green-500/50">
                            <Icon v-if="isSubmittingComment" icon="lucide:loader-2" class="animate-spin" />
                            {{ $t('pr_view.comment') || 'Comment' }}
                        </button>
                     </div>
                  </div>
                </div>

             </div>
             
           </div>

           <!-- Right Column (Sidebar) -->
           <div class="w-[300px] flex-shrink-0 flex flex-col gap-6">
                            <!-- Review Actions -->
              <div class="flex flex-col gap-2 pb-6 border-b border-neutral-800">
                 <div class="text-xs text-neutral-400 font-medium mb-1">
                     {{ $t('pr_view.files_changed', { count: pr.changed_files || 0 }) || (pr.changed_files || 0) + ' files changed' }}
                     <span v-if="pr.changed_files === undefined" class="text-neutral-600">{{ $t('pr_view.not_fetched') || '(Not fetched)' }}</span>
                 </div>
                 <button :disabled="pr.state === 'closed' || !isReviewer" class="w-full bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 border border-blue-500/50 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed group/btn relative">
                    {{ $t('pr_view.review_suggest') || 'Review Code and Suggest Changes' }}
                 </button>
                 <button :disabled="pr.state === 'closed' || !isReviewer" class="w-full bg-green-900/30 hover:bg-green-800/50 text-green-400 border border-green-500/50 py-1.5 rounded text-sm transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed group/btn relative">
                    {{ $t('pr_view.submit_review') || 'Submit a Review' }}
                 </button>
                 
                 <button v-if="pr.state !== 'closed'" @click="handleClosePR" :disabled="isClosing" class="w-full bg-red-900/30 hover:bg-red-800/50 text-red-400 border border-red-500/50 py-1.5 rounded text-sm transition-colors mt-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Icon v-if="isClosing" icon="lucide:loader-2" class="animate-spin text-sm" />
                    <Icon v-else icon="lucide:x-circle" class="text-sm" />
                    <span>{{ $t('pr_view.close_pr') || 'Close Pull Request' }}</span>
                 </button>
                 <button v-else @click="handleReopenPR" :disabled="isReopening" class="w-full bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 border border-blue-500/50 py-1.5 rounded text-sm transition-colors mt-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Icon v-if="isReopening" icon="lucide:loader-2" class="animate-spin text-sm" />
                    <Icon v-else icon="lucide:rotate-ccw" class="text-sm" />
                    <span>{{ $t('pr_view.reopen_pr') || 'Reopen Pull Request' }}</span>
                 </button>
              </div>
              
               <div class="flex flex-col gap-4">
                <!-- Reviewers -->
                <div class="flex flex-col gap-2">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     {{ $t('settings.create_pr.reviewers') || 'Reviewers' }}
                   </div>
                   <div v-if="selectedReviewers.length === 0" class="flex flex-col gap-1 text-[11px] mb-1">
                      <div class="text-neutral-300 font-medium">{{ $t('pr_view.no_reviews') || 'No reviews' }}</div>
                      <div v-if="pr.state !== 'closed'">
                          <div v-if="!pr.draft" class="text-neutral-500">
                             {{ $t('pr_view.still_in_progress') || 'Still in progress?' }} 
                             <button @click="handleConvertToDraft" :disabled="isConvertingDraft" class="text-neutral-400 hover:text-white transition-colors underline hover:no-underline disabled:opacity-50 inline-flex items-center gap-1">
                                 <Icon v-if="isConvertingDraft" icon="lucide:loader-2" class="animate-spin text-xs" />
                                 {{ $t('pr_view.convert_to_draft') || 'Convert to draft' }}
                             </button>
                          </div>
                      </div>
                   </div>
                   <MultiSelect v-model="selectedReviewers" :options="reviewerOptions" :placeholder="$t('settings.create_pr.select_reviewers') || 'Select reviewers...'" />
                </div>

                <!-- Assignees -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     {{ $t('settings.create_pr.assignees') || 'Assignees' }}
                   </div>
                   <MultiSelect v-model="selectedAssignees" :options="userOptions" :placeholder="$t('settings.create_pr.select_assignees') || 'Select assignees...'" />
                </div>

                <!-- Labels -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     {{ $t('settings.create_pr.labels') || 'Labels' }}
                   </div>
                   <div v-if="selectedLabels.length > 0" class="flex flex-wrap gap-1.5 mb-1">
                      <div v-for="label in selectedLabels" :key="label" 
                           class="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 border border-neutral-700 bg-neutral-800 text-neutral-300">
                          <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: '#' + (availableLabels.find(l => l.name === label)?.color || '666') }"></div>
                          {{ label }}
                      </div>
                   </div>
                   <div v-else class="text-[11px] text-neutral-500 mb-1">{{ $t('pr_view.none_yet') || 'None yet' }}</div>
                   <MultiSelect v-model="selectedLabels" :options="labelOptions" :placeholder="$t('settings.create_pr.select_labels') || 'Select labels...'" />
                </div>

                <!-- Participants -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     {{ $t('pr_view.participants') || 'Participants' }}
                   </div>
                   <div class="flex items-center gap-1">
                      <img :src="pr.user?.avatar_url" class="w-6 h-6 rounded-full border border-neutral-800" :title="pr.user?.login" />
                      <!-- Additional logic could add assignees/reviewers dynamically -->
                   </div>
                </div>

                <!-- Branch -->
                <div class="flex flex-col gap-2 mt-4 border-t border-neutral-800 pt-4">
                   <div class="text-xs text-neutral-400 font-medium">{{ $t('pr_view.branch') || 'Branch' }}</div>
                   <div class="bg-blue-900/20 text-blue-400 px-2.5 py-1 rounded font-mono text-xs border border-blue-900/50 truncate" :title="pr.sourceBranch">
                     {{ pr.sourceBranch }}
                   </div>
                </div>
              </div>

           </div>
        </div>

      </div>
    </div>
  </div>
</template>

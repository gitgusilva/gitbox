<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { activePullRequest, requestInput } from '../services/modalService';
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
    convertPullRequestToDraft,
    submitPullRequestReview
} from '../services/pullRequestService';
import { showToast } from '../services/toastService';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import MultiSelect from './Common/MultiSelect.vue';
import Button from './Common/Button.vue';
import Tooltip from './Common/Tooltip.vue';
import { formatFullDate, formatDate } from '../utils/formatters';
import { generalSettings } from '../services/settingsService';

const { t } = useI18n();
const isClosing = ref(false);
const isReopening = ref(false);
const isConvertingDraft = ref(false);

// Viewer is the PR author — GitHub forbids approving/reviewing your own PR, and
// only the author (or a maintainer, which we can't detect yet) edits/closes it.
const isAuthor = computed(() =>
    !!pr.value && !!currentUserLogin.value && pr.value.user?.login === currentUserLogin.value
);

// Anyone who isn't the author can submit a review (approve / request changes),
// mirroring GitHub's rule.
const canReview = computed(() => !!pr.value && !!currentUserLogin.value && !isAuthor.value);

const isReviewing = ref(false);

async function handleReview(event: 'APPROVE' | 'REQUEST_CHANGES', body?: string) {
    if (!pr.value || isReviewing.value) return;
    isReviewing.value = true;
    try {
        await submitPullRequestReview(pr.value, event, body);
        showToast(
            t('pr_view.review') || 'Review',
            event === 'APPROVE' ? (t('pr_view.approved') || 'Approved') : (t('pr_view.changes_requested') || 'Changes requested'),
            event === 'APPROVE' ? 'success' : 'info'
        );
    } catch (e: any) {
        showToast(t('history_detail.toast_error') || 'Error', e?.message || 'Review failed', 'error');
    } finally {
        isReviewing.value = false;
    }
}

function handleApprove() {
    handleReview('APPROVE');
}

function handleRequestChanges() {
    requestInput(
        t('pr_view.request_changes') || 'Request changes',
        t('pr_view.request_changes_msg') || 'Describe the changes you want.',
        t('pr_view.request_changes_placeholder') || 'Your review comment…',
        '',
        t('pr_view.request_changes') || 'Request changes',
        (body: string) => handleReview('REQUEST_CHANGES', body)
    );
}

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

function getReactionIcon(reaction: string) {
    const icons: Record<string, string> = {
        '+1': 'lucide:thumbs-up',
        '-1': 'lucide:thumbs-down',
        'laugh': 'mdi:emoticon-laugh-outline',
        'confused': 'mdi:emoticon-confused-outline',
        'heart': 'mdi:heart-outline',
        'hooray': 'mdi:party-popper',
        'eyes': 'mdi:eye-outline',
        'rocket': 'mdi:rocket-launch-outline'
    };
    return icons[reaction] || 'mdi:emoticon-outline';
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
                activePullRequest.value.reactions = details.reactions;
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
        showToast(t('view.success'), t('view.pr_reopened'), 'success');
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
        showToast(t('view.success'), t('view.converted_to_draft'), 'success');
    } else {
        showToast(t('view.error'), t('view.convert_to_draft_failed'), 'error');
    }
}

</script>

<template>
  <div v-if="pr" class="flex-1 flex flex-col min-w-0 min-h-0 bg-app animate-in fade-in duration-300">
    <!-- Header -->
    <header class="bg-surface border-b border-line flex items-center justify-between px-4 py-2 flex-shrink-0">
      <div class="flex items-center gap-2 text-content font-medium">
        <Icon icon="mdi:github" class="text-xl" />
        <span class="text-sm">{{ t('view.github_pull_request') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Tooltip :text="t('view.open_in_browser')" position="left">
          <button @click="openExternal(pr.url)" class="text-content-muted hover:text-neutral-900 dark:hover:text-white transition-colors p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800">
            <Icon icon="lucide:external-link" class="text-sm" />
          </button>
        </Tooltip>
        <Tooltip :text="t('view.close')" position="left">
          <button @click="close" class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors outline-none">
            <Icon icon="lucide:x" class="text-lg" />
          </button>
        </Tooltip>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden p-6 relative">
      <div class="max-w-[1200px] mx-auto w-full flex flex-col gap-6 font-sans">
        
        <!-- PR Title Header -->
        <div class="flex flex-col gap-3 pb-6 border-b border-line">
           <div class="text-xs text-neutral-500 font-mono">#{{ pr.number }}</div>
           <h1 class="text-2xl text-content-strong font-medium flex items-center gap-3 w-full">
             <template v-if="!isEditingTitle">
                <span class="break-words">{{ pr.title }}</span>
                <button @click="isEditingTitle = true" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white p-1 opacity-0 hover:opacity-100 transition-opacity">
                  <Icon icon="lucide:edit-2" class="text-sm" />
                </button>
             </template>
             <template v-else>
                <div class="flex items-center gap-2 w-full my-1">
                    <input v-model="editableTitle" @keyup.enter="saveTitle" :disabled="isSavingTitle" class="flex-1 bg-black/50 border border-neutral-300/80 dark:border-neutral-700/80 rounded px-3 py-1.5 text-content-strong text-xl focus:border-accent outline-none w-full shadow-inner" />
                    <Button variant="primary" :loading="isSavingTitle" @click="saveTitle">{{ t('common.save') }}</Button>
                    <Button variant="ghost" @click="isEditingTitle = false; editableTitle = pr.title">{{ t('common.cancel') }}</Button>
                </div>
             </template>
           </h1>
           <div class="flex items-center gap-3 text-sm text-content-muted">
             <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 transition-colors capitalize"
                  :class="pr.state === 'closed' ? 'bg-red-900/40 text-red-400 ring-red-500/50' : (pr.draft ? 'bg-neutral-200 dark:bg-neutral-800 text-content-muted ring-neutral-600/50' : 'bg-green-900/40 text-green-400 ring-green-500/50')">
                {{ pr.state === 'closed' ? pr.state : (pr.draft ? $t('pr_view.draft') || 'Draft' : pr.state) }}
             </div>
             <div class="flex items-center gap-2">
                <Tooltip :text="pr.user?.login">
                  <img :src="pr.user?.avatar_url" class="w-5 h-5 rounded-full" />
                </Tooltip>
                <span class="font-bold text-content">{{ pr.user?.login }}</span>
                <span>{{ t('view.wants_to_merge') }} <span class="bg-accent/15 text-accent px-1.5 py-0.5 rounded font-mono text-xs">{{ pr.sourceBranch }}</span> {{ t('view.into') }} <span class="bg-accent/15 text-accent px-1.5 py-0.5 rounded font-mono text-xs">{{ pr.targetBranch }}</span></span>
             </div>
           </div>
        </div>

        <!-- 2 Column Layout -->
        <div class="flex flex-col md:flex-row gap-8">
           <!-- Left Column -->
           <div class="flex-1 flex flex-col gap-6 min-w-0">
             
             <!-- Description Area -->
             <div class="flex flex-col gap-2 relative group/desc">
                <div class="flex items-center justify-between text-xs font-medium text-content">
                   {{ $t('settings.create_pr.description') || 'Description' }}
                   <button v-if="!isEditingDescription" @click="isEditingDescription = true" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white opacity-0 group-hover/desc:opacity-100 transition-opacity"><Icon icon="lucide:edit-2" /></button>
                </div>
                <!-- Markdown Content -->
                <div v-if="!isEditingDescription" class="bg-app text-content prose prose-invert prose-sm max-w-none prose-a:text-accent hover:prose-a:text-accent-hover prose-a:underline prose-a:underline-offset-2 p-4 rounded-lg border border-line" @click="handleMarkdownClick">
                   <div v-if="pr.body" v-html="renderMd(pr.body)"></div>
                   <div v-else class="text-neutral-500 italic">{{ $t('pr_view.no_description') || 'No description provided.' }}</div>
                   <!-- Main Reactions -->
                   <div v-if="pr.reactions && pr.reactions.total_count > 0" class="mt-4 flex flex-wrap gap-2">
                     <template v-for="(count, key) in pr.reactions" :key="key">
                       <Tooltip v-if="typeof count === 'number' && count > 0 && String(key) !== 'total_count' && String(key) !== 'url'" :text="String(key)">
                         <div class="flex items-center gap-1.5 bg-neutral-200/80 dark:bg-neutral-800/80 border border-neutral-300/50 dark:border-neutral-700/50 rounded-full px-2.5 py-0.5 text-[10px] text-content-muted hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-default">
                           <Icon :icon="getReactionIcon(String(key))" class="text-[12px]" />
                           <span class="font-medium">{{ count }}</span>
                         </div>
                       </Tooltip>
                     </template>
                   </div>
                </div>
                <!-- Edit Mode -->
                <div v-else class="flex flex-col gap-2">
                    <textarea v-model="editableDescription" :disabled="isSavingDescription" class="w-full min-h-[150px] bg-black/50 border border-line-strong rounded-lg p-3 text-sm text-content focus:border-accent outline-none resize-y font-mono shadow-inner"></textarea>
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <Button variant="ghost" @click="isEditingDescription = false; editableDescription = pr.body || ''">{{ $t('common.cancel') }}</Button>
                        <Button variant="primary" :loading="isSavingDescription" @click="saveDescription">{{ $t('pr_view.save') || 'Save' }}</Button>
                    </div>
                </div>
             </div>
             
             <!-- Comments Area -->
             <div class="flex flex-col gap-4 mt-6">
                <div class="flex items-center justify-between text-xs font-medium text-content">
                   {{ $t('pr_view.comments') || 'Comments' }}
                   <button @click="loadComments" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white" :class="{'animate-spin text-accent': isLoadingComments}"><Icon icon="lucide:refresh-cw" /></button>
                </div>
                
                <div v-if="comments.length === 0 && !isLoadingComments" class="text-xs text-neutral-600 italic">{{ $t('pr_view.no_comments') || 'No comments yet.' }}</div>
                
                <!-- Comments List -->
                <div class="relative flex flex-col gap-6">
                   <!-- Vertical connection line -->
                   <div v-if="comments.length > 0" class="absolute left-[15px] top-6 bottom-8 w-[2px] bg-neutral-200 dark:bg-neutral-800 z-0 rounded-full"></div>
                   
                   <div v-for="comment in comments" :key="comment.id" class="flex items-start gap-3 relative z-10">
                      <Tooltip :text="comment.user?.login">
                        <img :src="comment.user?.avatar_url" class="w-8 h-8 rounded-full border-2 border-line bg-app flex-shrink-0" />
                      </Tooltip>
                      <div class="flex-1 bg-surface rounded-lg border border-line overflow-hidden">
                         <div class="bg-neutral-200/50 dark:bg-neutral-800/50 px-3 py-2 border-b border-line text-xs flex items-center justify-between group">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-content">{{ comment.user?.login }}</span>
                                <span class="text-neutral-500">{{ formatDate(comment.createdAt) }}</span>
                            </div>
                             <Tooltip :text="t('view.open_in_browser')" position="left">
                               <button @click="openExternal(comment.url)" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"><Icon icon="lucide:external-link" /></button>
                             </Tooltip>
                         </div>
                         <div class="p-4 text-sm text-content prose prose-invert prose-sm max-w-none prose-a:text-accent hover:prose-a:text-accent-hover prose-a:underline prose-a:underline-offset-2" v-html="renderMd(comment.body)" @click="handleMarkdownClick">
                         </div>
                         <!-- Reactions -->
                          <div v-if="comment.reactions && comment.reactions.total_count > 0" class="px-4 pb-3 flex flex-wrap gap-2">
                            <template v-for="(count, key) in comment.reactions" :key="key">
                               <Tooltip v-if="typeof count === 'number' && count > 0 && String(key) !== 'total_count' && String(key) !== 'url'" :text="String(key)">
                                 <div class="flex items-center gap-1.5 bg-neutral-200/80 dark:bg-neutral-800/80 border border-neutral-300/50 dark:border-neutral-700/50 rounded-full px-2.5 py-0.5 text-[10px] text-content-muted hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-default">
                                   <Icon :icon="getReactionIcon(String(key))" class="text-[12px]" />
                                   <span class="font-medium">{{ count }}</span>
                                 </div>
                               </Tooltip>
                            </template>
                          </div>
                      </div>
                   </div>
                </div>

                <!-- Add Comment Input Box -->
                <div class="flex gap-3 mt-4 relative z-10 w-full">
                  <div class="flex-1 bg-surface border border-line-strong focus-within:border-accent rounded-lg overflow-hidden transition-colors flex flex-col shadow-inner">
                     <textarea v-model="newComment" :disabled="isSubmittingComment" class="w-full bg-transparent border-none outline-none resize-none min-h-[80px] p-3 text-sm text-content placeholder:text-neutral-600 disabled:opacity-50" :placeholder="$t('pr_view.add_comment') || 'Add a comment...'"></textarea>
                     <div class="bg-surface/60 border-t border-neutral-200/50 dark:border-neutral-800/50 p-2 flex justify-end gap-2">
                        <Button variant="success" :loading="isSubmittingComment" :disabled="!newComment.trim()" @click="submitComment">{{ $t('pr_view.comment') || 'Comment' }}</Button>
                     </div>
                  </div>
                </div>

             </div>
             
           </div>

           <!-- Right Column (Sidebar) -->
           <div class="w-[300px] flex-shrink-0 flex flex-col gap-6">
                             <!-- Review Actions -->
              <div class="flex flex-col gap-2 pb-6 border-b border-line">
                 <div class="text-xs text-content-muted font-medium mb-1">
                     {{ $t('pr_view.files_changed', { count: pr.changed_files || 0 }) || (pr.changed_files || 0) + ' files changed' }}
                     <span v-if="pr.changed_files === undefined" class="text-neutral-600">{{ $t('pr_view.not_fetched') || '(Not fetched)' }}</span>
                 </div>
                 <!-- Review actions: only a non-author (reviewer) can approve / request
                      changes — GitHub forbids reviewing your own PR. -->
                 <template v-if="canReview && pr.state !== 'closed'">
                   <Button variant="success" block icon="lucide:check" :loading="isReviewing" @click="handleApprove">
                     {{ $t('pr_view.approve') || 'Approve' }}
                   </Button>
                   <Button variant="danger" block icon="lucide:file-diff" :disabled="isReviewing" @click="handleRequestChanges">
                     {{ $t('pr_view.request_changes') || 'Request changes' }}
                   </Button>
                 </template>

                 <!-- Close / reopen: the PR author manages their own PR. -->
                 <Button v-if="isAuthor && pr.state !== 'closed'" variant="danger" block icon="lucide:x-circle" :loading="isClosing" @click="handleClosePR">
                   {{ $t('pr_view.close_pr') || 'Close Pull Request' }}
                 </Button>
                 <Button v-else-if="isAuthor && pr.state === 'closed'" variant="secondary" block icon="lucide:rotate-ccw" :loading="isReopening" @click="handleReopenPR">
                   {{ $t('pr_view.reopen_pr') || 'Reopen Pull Request' }}
                 </Button>
              </div>
              
               <div class="flex flex-col gap-4">
                <!-- Reviewers -->
                <div class="flex flex-col gap-2">
                   <div class="flex items-center justify-between text-xs text-content-muted font-medium">
                     {{ $t('settings.create_pr.reviewers') || 'Reviewers' }}
                   </div>
                   <div v-if="selectedReviewers.length === 0" class="flex flex-col gap-1 text-[11px] mb-1">
                      <div class="text-content font-medium">{{ $t('pr_view.no_reviews') || 'No reviews' }}</div>
                      <div v-if="pr.state !== 'closed'">
                          <div v-if="!pr.draft" class="text-neutral-500">
                             {{ $t('pr_view.still_in_progress') || 'Still in progress?' }} 
                             <button @click="handleConvertToDraft" :disabled="isConvertingDraft" class="text-content-muted hover:text-neutral-900 dark:hover:text-white transition-colors underline hover:no-underline disabled:opacity-50 inline-flex items-center gap-1">
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
                   <div class="flex items-center justify-between text-xs text-content-muted font-medium">
                     {{ $t('settings.create_pr.assignees') || 'Assignees' }}
                   </div>
                   <MultiSelect v-model="selectedAssignees" :options="userOptions" :placeholder="$t('settings.create_pr.select_assignees') || 'Select assignees...'" />
                </div>

                <!-- Labels -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-content-muted font-medium">
                     {{ $t('settings.create_pr.labels') || 'Labels' }}
                   </div>
                   <div v-if="selectedLabels.length > 0" class="flex flex-wrap gap-1.5 mb-1">
                      <div v-for="label in selectedLabels" :key="label" 
                           class="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 border border-line-strong bg-neutral-200 dark:bg-neutral-800 text-content">
                          <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: '#' + (availableLabels.find(l => l.name === label)?.color || '666') }"></div>
                          {{ label }}
                      </div>
                   </div>
                   <div v-else class="text-[11px] text-neutral-500 mb-1">{{ $t('pr_view.none_yet') || 'None yet' }}</div>
                   <MultiSelect v-model="selectedLabels" :options="labelOptions" :placeholder="$t('settings.create_pr.select_labels') || 'Select labels...'" />
                </div>

                <!-- Participants -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-content-muted font-medium">
                     {{ $t('pr_view.participants') || 'Participants' }}
                   </div>
                   <div class="flex items-center gap-1">
                       <Tooltip :text="pr.user?.login">
                         <img :src="pr.user?.avatar_url" class="w-6 h-6 rounded-full border border-line" />
                       </Tooltip>
                      <!-- Additional logic could add assignees/reviewers dynamically -->
                   </div>
                </div>

                <!-- Branch -->
                <div class="flex flex-col gap-2 mt-4 border-t border-line pt-4">
                   <div class="text-xs text-content-muted font-medium">{{ $t('pr_view.branch') || 'Branch' }}</div>
                    <Tooltip :text="pr.sourceBranch">
                      <div class="bg-blue-900/20 text-blue-400 px-2.5 py-1 rounded font-mono text-xs border border-blue-900/50 truncate">
                        {{ pr.sourceBranch }}
                      </div>
                    </Tooltip>
                </div>
              </div>

           </div>
        </div>

      </div>
    </div>
  </div>
</template>

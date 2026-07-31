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
    fetchPullRequestStats,
    convertPullRequestToDraft,
    submitPullRequestReview
} from '../services/pullRequestService';
import type { ReactionTarget } from '../services/pullRequestService';
import { showToast } from '../services/toastService';
import MultiSelect from './Common/MultiSelect.vue';
import Button from './Common/Button.vue';
import Tooltip from './Common/Tooltip.vue';
import BranchChip from './Common/BranchChip.vue';
import MarkdownView from './Common/MarkdownView.vue';
import ReactionBar from './PullRequest/ReactionBar.vue';
import PullRequestFiles from './PullRequest/PullRequestFiles.vue';
import PullRequestDiffPanel from './PullRequest/PullRequestDiffPanel.vue';
import PullRequestStateBadge from './PullRequest/PullRequestStateBadge.vue';
import PullRequestStats from './PullRequest/PullRequestStats.vue';
import { formatDate, openExternalUrl } from '../utils/formatters';
import { usePullRequestFiles } from '../composables/usePullRequestFiles';

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

// --- State ------------------------------------------------------------------
/** Only an open PR can be approved, closed or converted to a draft. */
const isOpen = computed(() => pr.value?.state === 'open');

// --- Reactions --------------------------------------------------------------
const prReactionTarget = computed<ReactionTarget>(() => ({
    kind: 'pr',
    id: pr.value?.number ?? 0,
    prNumber: pr.value?.number ?? 0,
}));

function commentReactionTarget(comment: any): ReactionTarget {
    return {
        kind: comment.kind === 'review_comment' ? 'review_comment' : 'issue_comment',
        id: comment.id,
        prNumber: pr.value?.number ?? 0,
    };
}

/** Reacting needs an identified user, same as commenting. */
const canReact = computed(() => !!currentUserLogin.value);

const pr = computed(() => activePullRequest.value);

// Changed files + the diff of the open one. Shared between the list in the
// conversation column and the docked panel that renders the diff.
const prFiles = usePullRequestFiles(() => pr.value);

watch(pr, async (newPr) => {
    if (newPr) {
        editableTitle.value = newPr.title || '';
        editableDescription.value = newPr.body || '';
        selectedAssignees.value = newPr.assignees?.map((a: any) => a.login) || [];
        selectedReviewers.value = newPr.requestedReviewers?.map((r: any) => r.login) || [];
        selectedLabels.value = newPr.labels?.map((l: any) => l.name) || [];
        
        loadComments();
        
        // The list endpoint carries no counters or merge state; fold the detail
        // payload into the active PR so the sidebar and the file list have the
        // SHAs and stats they need.
        fetchPullRequestStats(newPr.number).then(details => {
            if (activePullRequest.value && activePullRequest.value.number === newPr.number) {
                Object.assign(activePullRequest.value, details);
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
          <button @click="openExternalUrl(pr.url)" class="text-content-muted hover:text-content-strong transition-colors p-1 rounded hover:bg-surface-hover">
            <Icon icon="lucide:external-link" class="text-sm" />
          </button>
        </Tooltip>
        <Tooltip :text="t('view.close')" position="left">
          <button @click="close" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover shrink-0 text-content-muted hover:text-content-strong transition-colors outline-none">
            <Icon icon="lucide:x" class="text-lg" />
          </button>
        </Tooltip>
      </div>
    </header>

    <!-- Main Content -->
    <!-- The diff panel floats over this area (see PullRequestDiffPanel): the
         conversation keeps its two-column layout instead of reflowing into a
         sliver every time a file is opened. -->
    <div class="flex-1 relative min-h-0 min-w-0">
    <div class="absolute inset-0 overflow-y-auto overflow-x-hidden p-6">
      <div class="max-w-[1200px] mx-auto w-full flex flex-col gap-6 font-sans">
        
        <!-- PR Title Header -->
        <div class="flex flex-col gap-3 pb-6 border-b border-line">
           <div class="text-xs text-content-muted font-mono">#{{ pr.number }}</div>
           <h1 class="text-2xl text-content-strong font-medium flex items-center gap-3 w-full">
             <template v-if="!isEditingTitle">
                <span class="break-words">{{ pr.title }}</span>
                <button @click="isEditingTitle = true" class="text-content-muted hover:text-content-strong p-1 opacity-0 hover:opacity-100 transition-opacity">
                  <Icon icon="lucide:edit-2" class="text-sm" />
                </button>
             </template>
             <template v-else>
                <div class="flex items-center gap-2 w-full my-1">
                    <input v-model="editableTitle" @keyup.enter="saveTitle" :disabled="isSavingTitle" class="flex-1 bg-surface border border-line-strong rounded px-3 py-1.5 text-content-strong text-xl focus:border-accent outline-none w-full shadow-inner" />
                    <Button variant="primary" :loading="isSavingTitle" @click="saveTitle">{{ t('common.save') }}</Button>
                    <Button variant="ghost" @click="isEditingTitle = false; editableTitle = pr.title">{{ t('common.cancel') }}</Button>
                </div>
             </template>
           </h1>
           <div class="flex items-center gap-3 text-sm text-content-muted flex-wrap">
             <PullRequestStateBadge :state="pr.state" :draft="pr.draft" />
             <div class="flex items-center gap-2 flex-wrap">
                <Tooltip :text="pr.user?.login">
                  <img :src="pr.user?.avatar_url" class="w-5 h-5 rounded-full" />
                </Tooltip>
                <span class="font-bold text-content">{{ pr.user?.login }}</span>
                <span class="flex items-center gap-1.5 flex-wrap">
                  {{ t('view.wants_to_merge') }}
                  <BranchChip :name="pr.sourceBranch" :url="pr.sourceBranchUrl" />
                  {{ t('view.into') }}
                  <BranchChip :name="pr.targetBranch" :url="pr.targetBranchUrl" />
                </span>
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
                   <button v-if="!isEditingDescription" @click="isEditingDescription = true" class="text-content-muted hover:text-content-strong opacity-0 group-hover/desc:opacity-100 transition-opacity"><Icon icon="lucide:edit-2" /></button>
                </div>
                <!-- Markdown Content -->
                <div v-if="!isEditingDescription" class="bg-app p-4 rounded-lg border border-line">
                   <MarkdownView :content="pr.body" :empty-text="$t('pr_view.no_description')" />
                   <ReactionBar class="mt-4"
                                :target="prReactionTarget"
                                :initial="pr.reactions"
                                :can-react="canReact" />
                </div>
                <!-- Edit Mode -->
                <div v-else class="flex flex-col gap-2">
                    <textarea v-model="editableDescription" :disabled="isSavingDescription" class="w-full min-h-[150px] bg-surface border border-line-strong rounded-lg p-3 text-sm text-content focus:border-accent outline-none resize-y font-mono shadow-inner"></textarea>
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <Button variant="ghost" @click="isEditingDescription = false; editableDescription = pr.body || ''">{{ $t('common.cancel') }}</Button>
                        <Button variant="primary" :loading="isSavingDescription" @click="saveDescription">{{ $t('pr_view.save') || 'Save' }}</Button>
                    </div>
                </div>
             </div>
             
             <!-- Files changed: click a row to read the diff in the editor. -->
             <PullRequestFiles class="mt-2"
                               :files="prFiles.files.value"
                               :is-loading="prFiles.isLoading.value"
                               :load-error="prFiles.loadError.value"
                               :totals="prFiles.totals.value"
                               :active-path="prFiles.openFile.value?.path"
                               @select="prFiles.openAt"
                               @refresh="prFiles.load" />

             <!-- Comments Area -->
             <div class="flex flex-col gap-4 mt-6">
                <div class="flex items-center justify-between text-xs font-medium text-content">
                   {{ $t('pr_view.comments') || 'Comments' }}
                   <button @click="loadComments" class="text-content-muted hover:text-content-strong" :class="{'animate-spin text-accent': isLoadingComments}"><Icon icon="lucide:refresh-cw" /></button>
                </div>
                
                <div v-if="comments.length === 0 && !isLoadingComments" class="text-xs text-content-muted italic">{{ $t('pr_view.no_comments') || 'No comments yet.' }}</div>
                
                <!-- Comments List -->
                <div class="relative flex flex-col gap-6">
                   <!-- Vertical connection line -->
                   <div v-if="comments.length > 0" class="absolute left-[15px] top-6 bottom-8 w-[2px] bg-surface-hover z-0 rounded-full"></div>
                   
                   <div v-for="comment in comments" :key="comment.id" class="flex items-start gap-3 relative z-10">
                      <Tooltip :text="comment.user?.login">
                        <img :src="comment.user?.avatar_url" class="w-8 h-8 rounded-full border-2 border-line bg-app flex-shrink-0" />
                      </Tooltip>
                      <div class="flex-1 bg-surface rounded-lg border border-line overflow-hidden">
                         <div class="bg-surface-hover px-3 py-2 border-b border-line text-xs flex items-center justify-between group">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-content">{{ comment.user?.login }}</span>
                                <span class="text-content-muted">{{ formatDate(comment.createdAt) }}</span>
                            </div>
                             <Tooltip :text="t('view.open_in_browser')" position="left">
                               <button @click="openExternalUrl(comment.url)" class="text-content-muted hover:text-content-strong opacity-0 group-hover:opacity-100 transition-opacity"><Icon icon="lucide:external-link" /></button>
                             </Tooltip>
                         </div>
                         <MarkdownView class="p-4 text-sm" :content="comment.body" />
                         <!-- Reactions -->
                          <ReactionBar class="px-4 pb-3"
                                       :target="commentReactionTarget(comment)"
                                       :initial="comment.reactions"
                                       :can-react="canReact" />
                      </div>
                   </div>
                </div>

                <!-- Add Comment Input Box -->
                <div class="flex gap-3 mt-4 relative z-10 w-full">
                  <div class="flex-1 bg-surface border border-line-strong focus-within:border-accent rounded-lg overflow-hidden transition-colors flex flex-col shadow-inner">
                     <textarea v-model="newComment" :disabled="isSubmittingComment" class="w-full bg-transparent border-none outline-none resize-none min-h-[80px] p-3 text-sm text-content placeholder:text-content-muted disabled:opacity-50" :placeholder="$t('pr_view.add_comment') || 'Add a comment...'"></textarea>
                     <div class="bg-surface/60 border-t border-line p-2 flex justify-end gap-2">
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
                 <!-- Summary of the change, filled in by the detail fetch. -->
                 <PullRequestStats :pr="pr" class="mb-2" />

                 <!-- Review actions: only a non-author (reviewer) can approve / request
                      changes — GitHub forbids reviewing your own PR. -->
                 <template v-if="canReview && isOpen">
                   <Button variant="success" block icon="lucide:check" :loading="isReviewing" @click="handleApprove">
                     {{ $t('pr_view.approve') || 'Approve' }}
                   </Button>
                   <Button variant="danger" block icon="lucide:file-diff" :disabled="isReviewing" @click="handleRequestChanges">
                     {{ $t('pr_view.request_changes') || 'Request changes' }}
                   </Button>
                 </template>

                 <!-- Close / reopen: the PR author manages their own PR. -->
                 <Button v-if="isAuthor && isOpen" variant="danger" block icon="lucide:x-circle" :loading="isClosing" @click="handleClosePR">
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
                      <div v-if="isOpen">
                          <div v-if="!pr.draft" class="text-content-muted">
                             {{ $t('pr_view.still_in_progress') || 'Still in progress?' }}
                             <button @click="handleConvertToDraft" :disabled="isConvertingDraft" class="text-content-muted hover:text-content-strong transition-colors underline hover:no-underline disabled:opacity-50 inline-flex items-center gap-1">
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
                           class="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 border border-line-strong bg-surface-hover text-content">
                          <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: '#' + (availableLabels.find(l => l.name === label)?.color || '666') }"></div>
                          {{ label }}
                      </div>
                   </div>
                   <div v-else class="text-[11px] text-content-muted mb-1">{{ $t('pr_view.none_yet') || 'None yet' }}</div>
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
                      <div class="bg-accent/15 text-accent px-2.5 py-1 rounded font-mono text-xs border border-accent/30 truncate">
                        {{ pr.sourceBranch }}
                      </div>
                    </Tooltip>
                </div>
              </div>

           </div>
        </div>

      </div>
    </div>

    <PullRequestDiffPanel v-if="prFiles.openFile.value"
                          :file="prFiles.openFile.value"
                          :original="prFiles.original.value"
                          :modified="prFiles.modified.value"
                          :is-loading="prFiles.isLoadingDiff.value"
                          :error="prFiles.diffError.value"
                          :index="prFiles.openIndex.value ?? 0"
                          :total="prFiles.files.value.length"
                          @close="prFiles.close"
                          @step="prFiles.step" />
    </div>

  </div>
</template>

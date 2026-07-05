<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { isCreatePROpen, isSettingsOpen, settingsActiveSection } from '../services/modalService';
import { useIntegrations } from '../services/integrations';
import { repoPath, branches as gitBranches } from '../services/gitService';
import { loadPullRequests, getProvider } from '../services/pullRequestService';
import { showToast } from '../services/toastService';
import { getItem } from '../services/storageService';
import Select from './Common/Select.vue';
import Tooltip from './Common/Tooltip.vue';
import Modal from './Common/Modal.vue';
import { isAIConfigured, generatePRSummary } from '../services/ai/index';

const connectedProviders = computed(() => integrationsList.value.filter(i => i.connected));
const selectedProviderId = ref('');

const repos = ref<{ id: string | number, name: string, full_name: string }[]>([]);
const fromRepo = ref('');
const toRepo = ref('');
const fromBranch = ref('');
const toBranch = ref('');
const title = ref('');
const description = ref('');
const isDraft = ref(false);
const isLoading = ref(false);
const isGeneratingAI = ref(false);
const error = ref('');

const availableBranches = ref<string[]>([]);
const availableBranchesOptions = computed(() => availableBranches.value.map(b => ({ value: b, label: b, icon: 'mdi:source-branch' })));

const availableUsers = ref<any[]>([]);
const availableLabels = ref<any[]>([]);

const userOptions = computed(() => {
    return availableUsers.value.map(u => ({
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

const selectedAssignees = ref<string[]>([]);
const selectedReviewers = ref<string[]>([]);
const selectedLabels = ref<string[]>([]);

const hasConflicts = ref(false);
const conflictingFiles = ref<string[]>([]);
const isCheckingConflicts = ref(false);

const { t } = useI18n();
const { list: integrationsList, getValidSession, getSession } = useIntegrations();

watch(repoPath, () => {
    selectedProviderId.value = '';
    title.value = '';
    description.value = '';
    selectedReviewers.value = [];
    selectedAssignees.value = [];
    selectedLabels.value = [];
    fromBranch.value = '';
    toBranch.value = '';
    hasConflicts.value = false;
    conflictingFiles.value = [];
    error.value = '';
});

const currentUserLogin = computed(() => getSession(selectedProviderId.value)?.user?.login);

const reviewerOptions = computed(() => {
    return availableUsers.value
        .filter(u => u.login !== currentUserLogin.value)
        .map(u => ({
            value: u.login,
            label: u.login,
            iconUrl: u.avatar_url
        }));
});

watch(isCreatePROpen, async (isOpen) => {
    if (!isOpen) return;

    isLoading.value = true;
    error.value = '';
    
    // Auto-fill from current branch
    const head = gitBranches.value.find(b => b.is_head);
    if (head) {
        fromBranch.value = head.name;
        title.value = head.name;
    }

    try {
        const remoteUrl = await window.gitbox?.getRemoteUrl(repoPath.value);
        const resolved = getProvider(remoteUrl);
        
        if (resolved) {
            selectedProviderId.value = resolved.integrationId;
            let displayName = resolved.repoId;
            if (displayName.includes('/')) displayName = displayName.split('/')[1];

            repos.value = [{ id: resolved.repoId, name: displayName, full_name: resolved.repoId }];
            fromRepo.value = resolved.repoId;
            toRepo.value = resolved.repoId;
            
            await fetchBranchesAndData(resolved.provider, resolved.repoId);
        } else {
            error.value = t('modal.remote_no_integration');
        }
    } catch (e) {
        error.value = t('modal.load_repo_info_failed');
    } finally {
        isLoading.value = false;
    }
});

watch([fromBranch, toBranch], () => {
   if (fromBranch.value && toBranch.value) {
       checkConflicts();
   }
});

async function checkConflicts() {
    if (!window.gitbox?.checkMerge) return;
    if (fromBranch.value === toBranch.value) {
        hasConflicts.value = false;
        conflictingFiles.value = [];
        return;
    }
    isCheckingConflicts.value = true;
    try {
        const status = await window.gitbox.checkMerge(repoPath.value, toBranch.value, fromBranch.value);
        hasConflicts.value = status.hasConflicts;
        conflictingFiles.value = status.files || [];
    } catch(e) {
        hasConflicts.value = false;
        conflictingFiles.value = [];
    } finally {
        isCheckingConflicts.value = false;
    }
}

async function fetchBranchesAndData(provider: any, repoFullName: string) {
    try {
        const branches = await provider.fetchBranches(repoFullName);
        availableBranches.value = branches;

        if (branches.includes('main')) toBranch.value = 'main';
        else if (branches.includes('master')) toBranch.value = 'master';
        else if (branches.length > 0) toBranch.value = branches[0];

        const metadata = await provider.fetchMetadata(repoFullName);
        availableUsers.value = metadata.users || [];
        availableLabels.value = metadata.labels || [];
    } catch (e) {
        console.error('Failed to fetch repo data', e);
    }
}

async function handleCreatePR() {
    if (!title.value) return;
    
    if (fromBranch.value === toBranch.value) {
        const msg = t('settings.create_pr.same_branch') || 'Source and target branches cannot be the same.';
        
        error.value = msg;
        showToast(t('modal.error'), msg, 'error');

        return;
    }
    
    isLoading.value = true;
    error.value = '';
    
    try {
        const remoteUrl = await window.gitbox?.getRemoteUrl(repoPath.value);
        const resolved = getProvider(remoteUrl);

        if (!resolved) throw new Error(t('modal.cannot_determine_provider'));

        const data = await resolved.provider.createPR(toRepo.value, {
            title: title.value,
            description: description.value,
            fromBranch: fromBranch.value,
            toBranch: toBranch.value,
            isDraft: isDraft.value
        });
        
        // Apply assignees, reviewers, and labels if needed
        if (selectedAssignees.value.length || selectedLabels.value.length) {
            await resolved.provider.updateAssigneesAndLabels(toRepo.value, data.number, selectedAssignees.value, selectedLabels.value);
        }

        if (selectedReviewers.value.length) {
            try {
                await resolved.provider.updateReviewers(toRepo.value, data.number, selectedReviewers.value);
            } catch (err: any) {
                 showToast(t('modal.reviewers_warning'), err.message || t('modal.reviewers_request_failed'), 'warning');
            }
        }

        isCreatePROpen.value = false;
        loadPullRequests();
        showToast(t('modal.success'), t('modal.pr_created'), 'success');

        if (window.gitbox?.openExternal && data.url) {
             window.gitbox.openExternal(data.url);
        } else if (window.gitbox?.openExternal && data.html_url) {
             window.gitbox.openExternal(data.html_url);
        }
    } catch (e: any) {
        showToast(t('modal.error'), String(e.message || e), 'error');
        error.value = String(e.message || e);
    } finally {
        isLoading.value = false;
    }
}

async function generateWithAI() {
    if (!isAIConfigured()) {
        showToast(t('modal.error'), t('modal.ai_not_configured'), 'error');
        return;
    }

    isGeneratingAI.value = true;
    try {
        const commits = await window.gitbox?.log(repoPath.value, 15, fromBranch.value);
        let commitContext = commits?.map(c => `- ${c.summary}`).join('\n') || '';
        if (!commitContext) commitContext = 'Branch name: ' + fromBranch.value;

        const resp = await generatePRSummary(`From branch: ${fromBranch.value}\nTarget branch: ${toBranch.value}\n\nCommits details:\n${commitContext}`);
        
        if (resp.error) {
            showToast(t('modal.ai_error'), resp.error, 'error');
            return;
        }

        if (resp.text) {
            const lines = resp.text.split('\n');
            const titleLine = lines.find(l => l.toUpperCase().startsWith('TITLE:'));
            let desc = '';
            
            if (titleLine) {
                title.value = titleLine.substring('TITLE:'.length).trim();
                const descIndex = lines.findIndex(l => l.toUpperCase().startsWith('DESCRIPTION:'));
                if (descIndex !== -1) {
                    desc = lines.slice(descIndex + 1).join('\n').trim();
                }
            } else {
                title.value = lines[0].replace(/^TITLE:\s*/i, '').trim();
                desc = lines.slice(1).join('\n').replace(/^DESCRIPTION:\s*/i, '').trim();
            }
            
            if (desc) description.value = desc;
        }
    } catch (e: any) {
        showToast(t('modal.error'), t('modal.pr_ai_generate_failed'), 'error');
    } finally {
        isGeneratingAI.value = false;
    }
}

function openIntegrationsSettings() {
    isCreatePROpen.value = false;
    settingsActiveSection.value = 'integrations';
    isSettingsOpen.value = true;
}
</script>

<template>
    <Modal v-model="isCreatePROpen" :title="t('settings.create_pr.title')" icon="lucide:git-pull-request" width="850px">
        <div class="flex-1 overflow-x-hidden">

            <div v-if="error" class="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-medium flex items-center gap-2">
                <Icon icon="lucide:alert-circle" class="text-sm" />
                {{ error }}
            </div>

            <div class="p-8 space-y-6">
                <div v-if="connectedProviders.length === 0" class="text-center py-8 space-y-4">
                    <Icon icon="lucide:link-2-off" class="text-4xl text-neutral-700 mx-auto" />
                    <p class="text-sm text-content-muted">{{ t('modal.no_integrations_connected') }}</p>

                    <button @click="openIntegrationsSettings" class="text-xs text-blue-500 hover:underline">{{ t('modal.connect_in_settings') }}</button>
                </div>
            
            <template v-else>
                <!-- Selected Provider Info -->
                <div class="flex justify-center mb-4 border-b border-line pb-6">
                    <div v-if="selectedProviderId" class="flex flex-col items-center gap-2 group transition-all opacity-100 scale-105">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shadow-xl transition-all" 
                            :style="{ 
                                backgroundColor: (connectedProviders.find(p => p.id === selectedProviderId)?.color || '#555') + '20', 
                                color: connectedProviders.find(p => p.id === selectedProviderId)?.color || '#555' 
                            }"
                        >
                            <Icon :icon="connectedProviders.find(p => p.id === selectedProviderId)?.icon || 'lucide:git-pull-request'" />
                        </div>

                        <span class="text-[10px] font-bold uppercase tracking-widest text-content-muted group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                            {{ connectedProviders.find(p => p.id === selectedProviderId)?.name || 'Provider' }}
                        </span>

                        <div class="w-8 h-0.5 bg-blue-500 rounded-full" />
                    </div>
                </div>

                <div class="flex flex-col gap-6 relative">
                <!-- Left Column: Branches & Editor -->
                <div class="flex-1 space-y-6">
                    <!-- Branch Selection -->
                    <div class="flex items-center gap-4 w-full">
                        <div class="space-y-1.5 flex-1 min-w-0">
                            <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.from_repo') }} & {{ t('modal.branch') }}</label>
                            <div class="flex items-center gap-2">
                                <Select v-model="fromBranch" :options="availableBranchesOptions" searchable icon="mdi:source-branch" />
                            </div>
                        </div>

                        <Icon icon="lucide:arrow-right" class="text-neutral-600 mt-5 shrink-0" />

                        <div class="space-y-1.5 flex-1 min-w-0">
                            <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.to_repo') }} & {{ t('modal.branch') }}</label>
                            <div class="flex items-center gap-2">
                                <Select v-model="toBranch" :options="availableBranchesOptions" searchable icon="mdi:source-branch" />
                            </div>
                        </div>
                    </div>

                    <div v-if="error" class="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs flex items-center gap-2 animate-in slide-in-from-top-2 shadow-inner">
                        <Icon icon="lucide:alert-circle" class="shrink-0" />
                        <span>{{ error }}</span>
                    </div>

                    <!-- Conflicts Alert -->
                    <div v-if="hasConflicts" class="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                        <div class="flex items-center gap-2 text-yellow-500 font-bold mb-2">
                            <Icon icon="lucide:alert-triangle" /> {{ t('settings.create_pr.merge_conflict') }}
                        </div>

                        <div class="bg-black/20 p-2 rounded max-h-32 flex flex-col gap-1 overflow-y-auto w-full text-xs text-content-muted font-mono">
                            <span v-for="file in conflictingFiles" :key="file">{{ file }}</span>
                            <span v-if="conflictingFiles.length === 0">{{ t('settings.create_pr.hidden_conflicts') }}</span>
                        </div>
                    </div>

                    <!-- Title & Description -->
                    <div class="space-y-4">
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.pr_title') }}</label>
                                <Tooltip :text="isAIConfigured() ? '' : t('modal.configure_ai_hint')" position="top">
                                    <button @click="generateWithAI" 
                                            :disabled="isGeneratingAI || !isAIConfigured()" 
                                            class="text-[9px] bg-accent/20 text-accent px-2 py-0.5 rounded-full transition-colors flex items-center gap-1"
                                            :class="isGeneratingAI || !isAIConfigured() ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/30'">
                                    <Icon v-if="isGeneratingAI" icon="lucide:loader-2" class="animate-spin" />
                                    <Icon v-else icon="lucide:sparkles" /> 
                                    {{ isGeneratingAI ? t('common.loading') + '...' : t('settings.create_pr.generate') }}
                                    </button>
                                </Tooltip>
                            </div>

                            <input v-model="title" type="text" :placeholder="t('settings.create_pr.title_placeholder')" class="w-full bg-surface border border-line-strong/50 rounded-lg px-4 py-2 text-xs text-content-strong outline-none focus:border-accent transition-all shadow-inner" />
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.description') }}</label>
                            <textarea v-model="description" :placeholder="t('settings.create_pr.desc_placeholder')" rows="8" class="w-full bg-surface border border-line-strong/50 rounded-lg px-4 py-3 text-xs text-content-strong outline-none focus:border-accent transition-all resize-none shadow-inner"></textarea>
                        </div>
                    </div>
                </div>

                <!-- Metadata Multi-selects Below Description -->
                <div class="grid grid-cols-3 gap-4 border-t border-line pt-6">
                    <!-- Reviewers -->
                    <div class="space-y-2">
                        <label class="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                            {{ t('settings.create_pr.reviewers') }}
                        </label>
                        <Select v-model="selectedReviewers" multiple :options="reviewerOptions" :placeholder="t('settings.create_pr.select_reviewers')" />
                    </div>
                    
                    <!-- Assignees -->
                    <div class="space-y-2">
                        <label class="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                            {{ t('settings.create_pr.assignees') }}
                        </label>
                        <Select v-model="selectedAssignees" multiple :options="userOptions" :placeholder="t('settings.create_pr.select_assignees')" />
                    </div>

                    <!-- Labels -->
                    <div class="space-y-2">
                        <label class="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                            {{ t('settings.create_pr.labels') }}
                        </label>
                        <Select v-model="selectedLabels" multiple :options="labelOptions" :placeholder="t('settings.create_pr.select_labels')" />
                    </div>
                </div>
                
                </div>
                </template>
            </div>
        </div>

        <template #footer>
            <footer v-if="connectedProviders.length > 0" class="h-16 border-t border-line flex items-center justify-between px-6 bg-surface gap-3">
                <div class="flex items-center shrink-0">
                    <!-- Draft Checkbox moved here -->
                    <label class="flex items-center gap-2 cursor-pointer group">
                        <div class="w-4 h-4 rounded border border-line-strong flex items-center justify-center transition-all group-hover:border-neutral-500" :class="isDraft ? 'bg-accent border-accent' : 'bg-transparent'">
                            <Icon v-if="isDraft" icon="lucide:check" class="text-[10px] text-accent-fg" />
                        </div>
                        <input type="checkbox" v-model="isDraft" class="hidden" />
                        <span class="text-[11px] font-medium text-content-muted group-hover:text-neutral-800 dark:group-hover:text-neutral-200">{{ t('settings.create_pr.submit_as_draft') }}</span>
                    </label>
                </div>

                <div class="flex items-center gap-3">
                    <button @click="isCreatePROpen = false" class="px-6 py-2 rounded-lg text-xs font-bold text-content-muted hover:text-neutral-900 dark:hover:text-white hover:bg-white/5 transition-all">
                        {{ t('common.cancel') }}
                    </button>
                    <button @click="handleCreatePR" :disabled="!title || isLoading || !toBranch || !fromBranch || fromBranch === toBranch" :title="fromBranch === toBranch ? t('settings.create_pr.same_branch') || 'Source and target branches cannot be the same.' : ''" class="px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:grayscale text-accent-fg rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2">
                        <Icon v-if="isLoading" icon="lucide:loader-2" class="animate-spin" />
                        {{ t('common.create_pr') }}
                    </button>
                </div>
            </footer>
        </template>
    </Modal>
</template>

<style scoped>
select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-position: right 0.75rem center;
  background-repeat: no-repeat;
  background-size: 1rem;
}
</style>

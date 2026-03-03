<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { isCreatePROpen, isSettingsOpen, settingsActiveSection } from '../services/modalService';
import { useIntegrations } from '../services/integrations';
import { repoPath, branches as gitBranches } from '../services/gitService';
import { loadPullRequests } from '../services/pullRequestService';
import { showToast } from '../services/toastService';
import { getItem } from '../services/storageService';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';
import MultiSelect from './Common/MultiSelect.vue';
import Modal from './Common/Modal.vue';

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
const error = ref('');

const availableBranches = ref<string[]>([]);
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
const { list: integrationsList, getValidSession } = useIntegrations();

onMounted(async () => {
    if (connectedProviders.value.length > 0) {
        selectedProviderId.value = connectedProviders.value[0].id;
    }
    
    // Auto-fill from current branch
    const head = gitBranches.value.find(b => b.is_head);
    if (head) {
        fromBranch.value = head.name;
        title.value = head.name;
    }
});

watch(selectedProviderId, async (val) => {
    if (!val) return;
    isLoading.value = true;
    error.value = '';
    try {
        // Here we would call the provider to get repos
        // For now, let's assume we can only PR to the current repo if it's GitHub
        const remoteUrl = await window.gitbox?.getRemoteUrl(repoPath.value);
        if (remoteUrl) {
            let repoName = '';
            if (remoteUrl.includes('github.com:')) {
                repoName = remoteUrl.split('github.com:')[1].replace('.git', '');
            } else if (remoteUrl.includes('github.com/')) {
                const parts = remoteUrl.split('github.com/')[1].split('/');
                repoName = `${parts[0]}/${parts[1].replace('.git', '')}`;
            }
            
            if (repoName) {
                repos.value = [{ id: repoName, name: repoName.split('/')[1], full_name: repoName }];
                fromRepo.value = repoName;
                toRepo.value = repoName;
                
                // Fetch branches, users and labels for this repo
                await fetchBranchesAndData(repoName);
            }
        }
    } catch (e) {
        error.value = 'Failed to load repository info.';
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

async function fetchBranchesAndData(repoFullName: string) {
    const session = await getValidSession(selectedProviderId.value);
    if (!session?.accessToken) return;
    
    try {
        const response = await fetch(`https://api.github.com/repos/${repoFullName}/branches`, {
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json'
            }
        });
        if (response.ok) {
            const data = await response.json();
            availableBranches.value = data.map((b: any) => b.name);
            if (availableBranches.value.includes('main')) toBranch.value = 'main';
            else if (availableBranches.value.includes('master')) toBranch.value = 'master';
            else if (availableBranches.value.length > 0) toBranch.value = availableBranches.value[0];
        }

        // Fetch users (collaborators)
        const usersResp = await fetch(`https://api.github.com/repos/${repoFullName}/assignees`, {
             headers: { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json' }
        });
        if (usersResp.ok) {
            availableUsers.value = await usersResp.json();
        }

        // Fetch labels
        const labelsResp = await fetch(`https://api.github.com/repos/${repoFullName}/labels`, {
             headers: { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json' }
        });
        if (labelsResp.ok) {
            availableLabels.value = await labelsResp.json();
        }

    } catch (e) {
        console.error('Failed to fetch repo data', e);
    }
}

async function handleCreatePR() {
    if (!title.value) return;
    
    isLoading.value = true;
    error.value = '';
    
    try {
        const session = await getValidSession(selectedProviderId.value);
        if (!session?.accessToken) throw new Error('No valid session');
        
        const response = await fetch(`https://api.github.com/repos/${toRepo.value}/pulls`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title.value,
                body: description.value,
                head: fromBranch.value,
                base: toBranch.value,
                draft: isDraft.value
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Apply assignees, reviewers, and labels
            if (selectedAssignees.value.length || selectedLabels.value.length) {
                await fetch(`https://api.github.com/repos/${toRepo.value}/issues/${data.number}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json' },
                    body: JSON.stringify({ assignees: selectedAssignees.value, labels: selectedLabels.value })
                });
            }

            if (selectedReviewers.value.length) {
                await fetch(`https://api.github.com/repos/${toRepo.value}/pulls/${data.number}/requested_reviewers`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json' },
                    body: JSON.stringify({ reviewers: selectedReviewers.value })
                });
            }

            isCreatePROpen.value = false;
            loadPullRequests();
            showToast('Success', 'Pull Request created successfully.', 'success');

            if (window.gitbox?.openExternal) {
                 window.gitbox.openExternal(data.html_url);
            }
        } else {
            const errData = await response.json();
            const specificError = errData.errors && errData.errors[0] ? errData.errors[0].message : null;
            showToast('Failed to Create PR', specificError || errData.message || 'Unknown error occurred.', 'error', { duration: 10000 });
            error.value = specificError || errData.message || 'Unknown error occurred.';
        }
    } catch (e) {
        showToast('Error', String(e), 'error');
    } finally {
        isLoading.value = false;
    }
}

function generateWithAI() {
    // Future AI feature
    title.value = `PR: ${fromBranch.value}`;
    description.value = `This PR completes the work on branch ${fromBranch.value}.`;
}

function openIntegrationsSettings() {
    isCreatePROpen.value = false;
    settingsActiveSection.value = 'integrations';
    isSettingsOpen.value = true;
}
</script>

<template>
  <Modal v-model="isCreatePROpen" :title="t('settings.create_pr.title')" icon="lucide:git-pull-request" width="850px">
        <SimpleBar class="flex-1 overflow-x-hidden">
          <div class="p-8 space-y-6">
            <div v-if="connectedProviders.length === 0" class="text-center py-8 space-y-4">
               <Icon icon="lucide:link-2-off" class="text-4xl text-neutral-700 mx-auto" />
               <p class="text-sm text-neutral-400">No external integrations connected.</p>
               <button @click="openIntegrationsSettings" class="text-xs text-blue-500 hover:underline">Connect one in Settings</button>
            </div>
          
          <template v-else>
            <!-- Provider Selector -->
            <div class="flex justify-center gap-8 mb-4 border-b border-neutral-800 pb-6">
               <button v-for="item in connectedProviders" :key="item.id"
                       @click="selectedProviderId = item.id"
                       class="flex flex-col items-center gap-2 group transition-all"
                       :class="selectedProviderId === item.id ? 'opacity-100 scale-105' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'">
                  <div class="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shadow-xl transition-all" :style="{ backgroundColor: item.color + '20', color: item.color }">
                     <Icon :icon="item.icon" />
                  </div>
                  <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-400 group-hover:text-white transition-colors">{{ item.name }}</span>
                  <div v-if="selectedProviderId === item.id" class="w-8 h-0.5 bg-blue-500 rounded-full"></div>
               </button>
            </div>

            <div class="flex flex-col gap-6 relative">
              <!-- Left Column: Branches & Editor -->
              <div class="flex-1 space-y-6">
                <!-- Branch Selection -->
                <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                   <div class="space-y-1.5">
                      <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.from_repo') }} & Branch</label>
                      <div class="flex items-center gap-2">
                          <select v-model="fromBranch" class="flex-1 bg-[#2a2a2d] border border-neutral-700/50 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none">
                             <option v-for="b in availableBranches" :key="b" :value="b">{{ b }}</option>
                          </select>
                      </div>
                   </div>
                   <Icon icon="lucide:arrow-right" class="text-neutral-600 mt-5" />
                   <div class="space-y-1.5">
                      <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.to_repo') }} & Branch</label>
                      <div class="flex items-center gap-2">
                          <select v-model="toBranch" class="flex-1 bg-[#2a2a2d] border border-neutral-700/50 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all cursor-pointer appearance-none">
                             <option v-for="b in availableBranches" :key="b" :value="b">{{ b }}</option>
                          </select>
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
                    <div class="bg-black/20 p-2 rounded max-h-32 flex flex-col gap-1 overflow-y-auto w-full text-xs text-neutral-400 font-mono">
                        <span v-for="file in conflictingFiles" :key="file">{{ file }}</span>
                        <span v-if="conflictingFiles.length === 0">{{ t('settings.create_pr.hidden_conflicts') }}</span>
                    </div>
                </div>

                <!-- Title & Description -->
                <div class="space-y-4">
                   <div class="space-y-1.5">
                      <div class="flex items-center justify-between">
                         <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.pr_title') }}</label>
                         <button @click="generateWithAI" class="text-[9px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full hover:bg-blue-600/30 transition-colors flex items-center gap-1">
                            <Icon icon="lucide:sparkles" /> {{ t('settings.create_pr.generate') }}
                         </button>
                      </div>
                      <input v-model="title" type="text" :placeholder="t('settings.create_pr.title_placeholder')" class="w-full bg-[#2a2a2d] border border-neutral-700/50 rounded-lg px-4 py-2 text-xs text-white outline-none focus:border-blue-500 transition-all shadow-inner" />
                   </div>

                   <div class="space-y-1.5">
                      <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.create_pr.description') }}</label>
                      <textarea v-model="description" :placeholder="t('settings.create_pr.desc_placeholder')" rows="8" class="w-full bg-[#2a2a2d] border border-neutral-700/50 rounded-lg px-4 py-3 text-xs text-white outline-none focus:border-blue-500 transition-all resize-none shadow-inner"></textarea>
                   </div>
                </div>
              </div>

              <!-- Metadata Multi-selects Below Description -->
              <div class="grid grid-cols-3 gap-4 border-t border-neutral-800 pt-6">
                 <!-- Reviewers -->
                 <div class="space-y-2">
                    <label class="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        {{ t('settings.create_pr.reviewers') }}
                    </label>
                    <MultiSelect v-model="selectedReviewers" :options="userOptions" :placeholder="t('settings.create_pr.select_reviewers')" />
                 </div>
                 
                 <!-- Assignees -->
                 <div class="space-y-2">
                    <label class="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        {{ t('settings.create_pr.assignees') }}
                    </label>
                    <MultiSelect v-model="selectedAssignees" :options="userOptions" :placeholder="t('settings.create_pr.select_assignees')" />
                 </div>

                 <!-- Labels -->
                 <div class="space-y-2">
                    <label class="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        {{ t('settings.create_pr.labels') }}
                    </label>
                    <MultiSelect v-model="selectedLabels" :options="labelOptions" :placeholder="t('settings.create_pr.select_labels')" />
                 </div>
               </div>
              
             </div>
            </template>
          </div>
        </SimpleBar>

        <template #footer>
          <!-- Footer -->
          <footer v-if="connectedProviders.length > 0" class="h-16 border-t border-neutral-800 flex items-center justify-between px-6 bg-[#252526] gap-3">
           <div class="flex items-center shrink-0">
               <!-- Draft Checkbox moved here -->
               <label class="flex items-center gap-2 cursor-pointer group">
                  <div class="w-4 h-4 rounded border border-neutral-700 flex items-center justify-center transition-all group-hover:border-neutral-500" :class="isDraft ? 'bg-blue-600 border-blue-600' : 'bg-transparent'">
                    <Icon v-if="isDraft" icon="lucide:check" class="text-[10px] text-white" />
                  </div>
                  <input type="checkbox" v-model="isDraft" class="hidden" />
                  <span class="text-[11px] font-medium text-neutral-400 group-hover:text-neutral-200">{{ t('settings.create_pr.submit_as_draft') }}</span>
               </label>
           </div>
           <div class="flex items-center gap-3">
               <button @click="isCreatePROpen = false" class="px-6 py-2 rounded-lg text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
                  {{ t('common.cancel') }}
               </button>
               <button @click="handleCreatePR" :disabled="!title || isLoading || !toBranch || !fromBranch" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:grayscale text-white rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2">
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

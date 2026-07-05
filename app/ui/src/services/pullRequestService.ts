import { ref, watch } from 'vue';
import { repoPath, branches, isLoadingData, selectedLogRef } from './gitService';
import { useIntegrations, providers } from './integrations';
import { showToast } from './toastService';
import { isCreatePROpen } from './modalService';
import { generalSettings } from './settingsService';
import { PullRequest, PullRequestMetadata } from './pullRequests/types';
import { IPRProvider } from './pullRequests/providers/IPRProvider';

export type { PullRequest, PullRequestMetadata };

export const pullRequests = ref<PullRequest[]>([]);
export const isPRLoading = ref(false);
export const prError = ref<string | null>(null);

export const currentUserLogin = ref<string | null>(null);

const { getValidSession, list: integrationsList } = useIntegrations();

export function getProvider(url: string | null): { provider: IPRProvider, repoId: string, integrationId: string } | null {
    if (!url) return null;

    for (const integration of providers) {
        if (integration.matchUrl && integration.getPRProvider) {
            const repoId = integration.matchUrl(url);
            if (repoId) {
                return {
                    provider: integration.getPRProvider(async (force) => {
                        const session = await getValidSession(integration.id, force);
                        return session?.accessToken;
                    }),
                    repoId,
                    integrationId: integration.id
                };
            }
        }
    }

    return null;
}

export const hasActivePRProvider = ref(false);

// Helper to keep track of the last path we loaded PRs for
let lastLoadedPath = '';
let debounceTimer: any = null;

export async function loadPullRequests(force = false) {
    if (!repoPath.value || !window.gitbox) return;

    // Prevent concurrent loads if not forced
    if (isPRLoading.value && !force) return;

    // If it's the same path and we aren't forcing, skip
    // (This helps when multiple watchers trigger close together)
    if (!force && lastLoadedPath === repoPath.value && pullRequests.value.length > 0) {
        return;
    }

    let branchName = selectedLogRef.value;
    if (!branchName) {
        const currentBranch = branches.value.find(b => b.is_head);
        branchName = currentBranch?.name || '';
    }

    if (!branchName) return;

    isPRLoading.value = true;
    prError.value = null;
    lastLoadedPath = repoPath.value;

    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        const info = getProvider(remoteUrl);
        hasActivePRProvider.value = !!info;

        if (info) {
            // Update current user login dynamically based on the active provider
            const activeIntegration = integrationsList.value.find(i => i.id === info.integrationId && i.connected);

            if (activeIntegration?.user) {
                currentUserLogin.value = activeIntegration.user.login;
            } else {
                currentUserLogin.value = null; // Maybe default to null if not authenticated
            }

            try {
                pullRequests.value = await info.provider.fetchPRs(info.repoId, generalSettings.value.showClosedPRs);
            } catch (err: any) {
                if (err.message === 'github_404') {
                    prError.value = 'github_404';
                    console.error(`[PullRequests] O repositório '${info.repoId}' não foi encontrado.`);
                } else if (err.message === 'gitlab_404') {
                    prError.value = 'gitlab_404';
                    console.error(`[PullRequests] O repositório '${info.repoId}' não foi encontrado no GitLab.`);
                } else if (err.message === 'github_oauth_restrictions') {
                    prError.value = 'github_oauth_restrictions';
                    console.error(`[PullRequests] A organização '${info.repoId.split('/')[0]}' habilitou restrições de aplicativos OAuth.`);
                } else {
                    console.error('Failed to load PRs for provider', err);
                }
            }
        }
    } catch (e) {
        console.error('Failed to load PRs', e);
    } finally {
        isPRLoading.value = false;
    }
}

/**
 * Consistently load PRs with a small debounce to prevent flooding when 
 * multiple state changes occur at once.
 */
export function debouncedLoadPullRequests(force = false) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadPullRequests(force);
    }, 300);
}

export async function createPullRequest() {
    isCreatePROpen.value = true;
}

export async function closePullRequest(pr: PullRequest) {
    if (!repoPath.value || !window.gitbox) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (info) {
        const ok = await info.provider.closePR(info.repoId, pr.number);
        if (ok) loadPullRequests(true);
        return ok;
    }
    return false;
}

export async function submitPullRequestReview(pr: PullRequest, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body?: string) {
    if (!repoPath.value || !window.gitbox) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (!info) return false;
    const ok = await info.provider.submitReview(info.repoId, pr.number, event, body);
    if (ok) loadPullRequests(true);
    return ok;
}

export async function convertPullRequestToDraft(pr: PullRequest) {
    if (!repoPath.value || !window.gitbox || !pr.nodeId) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (info) {
        // GitHub uses nodeId, GitLab uses prNumber, let's pass both and adapter chooses
        const ok = await info.provider.convertToDraft(info.repoId, pr.nodeId);
        if (ok) loadPullRequests(true);
        return ok;
    }
    return false;
}

export async function updatePullRequest(pr: PullRequest, data: any) {
    if (!repoPath.value || !window.gitbox) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (info) {
        const ok = await info.provider.updatePR(info.repoId, pr.number, data);
        if (ok) {
            const index = pullRequests.value.findIndex(p => p.number === pr.number);
            if (index !== -1) {
                if (data.state) pullRequests.value[index].state = data.state;
                if (data.title) pullRequests.value[index].title = data.title;
                if (data.body !== undefined) pullRequests.value[index].body = data.body;
            }
            return true;
        }
    }
    return false;
}

export async function fetchPullRequestComments(pr: PullRequest) {
    if (!repoPath.value || !window.gitbox) return [];
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        const info = getProvider(remoteUrl);
        return info ? await info.provider.fetchComments(info.repoId, pr.number) : [];
    } catch (e) {
        console.error('Failed to fetch PR comments', e);
        return [];
    }
}

export async function addPullRequestComment(pr: PullRequest, body: string) {
    if (!repoPath.value || !window.gitbox) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    return info ? await info.provider.addComment(info.repoId, pr.number, body) : false;
}

export async function fetchPullRequestMetadata() {
    if (!repoPath.value || !window.gitbox) return { users: [], labels: [] };
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    return info ? await info.provider.fetchMetadata(info.repoId) : { users: [], labels: [] };
}

export async function updatePullRequestReviewers(pr: PullRequest, reviewers: string[]) {
    if (!repoPath.value || !window.gitbox) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (info) {
        const ok = await info.provider.updateReviewers(info.repoId, pr.number, reviewers);
        if (ok) loadPullRequests(true);
        else showToast('Error', 'Failed to update reviewers', 'error');
        return ok;
    }
    return false;
}

export async function updatePullRequestAssigneesAndLabels(pr: PullRequest, assignees: string[], labels: string[]) {
    if (!repoPath.value || !window.gitbox) return false;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (info) {
        const ok = await info.provider.updateAssigneesAndLabels(info.repoId, pr.number, assignees, labels);
        if (ok) loadPullRequests(true);
        return ok;
    }
    return false;
}

export async function fetchPullRequestDetails(prNumber: number) {
    if (!repoPath.value || !window.gitbox) return null;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    return info ? await info.provider.fetchPRDetails(info.repoId, prNumber) : null;
}

// Watchers para automação de carregamento
watch(repoPath, async (newPath, oldPath) => {
    if (newPath !== oldPath) {
        pullRequests.value = [];
        prError.value = null;
        lastLoadedPath = '';
    }

    if (newPath && window.gitbox) {
        try {
            const remoteUrl = await window.gitbox.getRemoteUrl(newPath);
            hasActivePRProvider.value = !!getProvider(remoteUrl);
        } catch (e) {
            hasActivePRProvider.value = false;
        }
    } else {
        hasActivePRProvider.value = false;
    }

    if (!isLoadingData.value) {
        debouncedLoadPullRequests();
    }
}, { immediate: true });

watch(integrationsList, () => {
    if (!isLoadingData.value) {
        debouncedLoadPullRequests(true);
    }
}, { deep: true });

watch(isLoadingData, (loading) => {
    if (!loading && repoPath.value) {
        debouncedLoadPullRequests();
    }
});

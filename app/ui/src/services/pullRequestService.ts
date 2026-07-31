import { computed, ref, watch } from 'vue';
import { repoPath, branches, isLoadingData, selectedLogRef } from './gitService';
import { useIntegrations, providers } from './integrations';
import { showToast } from './toastService';
import { activePullRequest, isCreatePROpen } from './modalService';
import { generalSettings } from './settingsService';
import { PRReaction, PullRequest, PullRequestFile, PullRequestMetadata, ReactionTarget } from './pullRequests/types';
import { IPRProvider } from './pullRequests/providers/IPRProvider';

export type { PullRequest, PullRequestMetadata, PullRequestFile, PRReaction, ReactionTarget };

export const pullRequests = ref<PullRequest[]>([]);
export const isPRLoading = ref(false);
export const prError = ref<string | null>(null);

/**
 * The list as it should be rendered. The provider already narrows the query
 * (state=open) but the filter is reapplied here so toggling "show closed PRs"
 * updates the UI on the spot instead of waiting for the network round-trip —
 * and so a PR closed while the app was open disappears as soon as any refresh
 * brings its new state in.
 */
export const visiblePullRequests = computed<PullRequest[]>(() =>
    generalSettings.value.showClosedPRs
        ? pullRequests.value
        : pullRequests.value.filter(pr => pr.state === 'open'),
);

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
let lastLoadedAt = 0;
let debounceTimer: any = null;

/**
 * How long a fetched list is considered fresh. The guard below used to skip
 * every non-forced load for a path that had already been loaded, so a PR
 * merged or closed on the web stayed in the sidebar for the whole session —
 * nothing short of switching repositories could refresh it. A short window
 * still collapses the burst of watchers that fire together on startup.
 */
const PR_FRESHNESS_MS = 15_000;

export async function loadPullRequests(force = false) {
    if (!repoPath.value || !window.gitbox) return;

    // Prevent concurrent loads if not forced
    if (isPRLoading.value && !force) return;

    // Same path, fetched moments ago: let the burst settle instead of hitting
    // the API once per watcher.
    if (!force && lastLoadedPath === repoPath.value && Date.now() - lastLoadedAt < PR_FRESHNESS_MS) {
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
                const list = await info.provider.fetchPRs(info.repoId, generalSettings.value.showClosedPRs);
                // Branch links are the provider's to build — only it knows the
                // forge's URL grammar.
                pullRequests.value = list.map(pr => ({
                    ...pr,
                    sourceBranchUrl: info.provider.branchUrl(pr.sourceRepoUrl, pr.sourceBranch),
                    targetBranchUrl: info.provider.branchUrl(pr.targetRepoUrl, pr.targetBranch),
                }));
                // Only a successful fetch starts the freshness window, so a
                // failed call is retried by the next trigger instead of being
                // treated as an up-to-date list.
                lastLoadedAt = Date.now();
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

/**
 * Resolves the provider for the open repository and runs `fn` with it,
 * answering `fallback` when there is no repository, no bridge or no provider.
 * Deliberately re-resolved per call: the remote can be changed from Settings
 * without the repository path changing, and a cached provider would keep
 * talking to the old forge.
 */
async function withProvider<T>(fallback: T, fn: (provider: IPRProvider, repoId: string) => Promise<T>): Promise<T> {
    if (!repoPath.value || !window.gitbox) return fallback;
    const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
    const info = getProvider(remoteUrl);
    if (!info) return fallback;
    return fn(info.provider, info.repoId);
}

/** The detail payload reduced to the fields the PR view renders. */
export async function fetchPullRequestStats(prNumber: number): Promise<Partial<PullRequest>> {
    return withProvider<Partial<PullRequest>>({}, async (provider, repoId) => {
        const raw = await provider.fetchPRDetails(repoId, prNumber);
        return provider.normalizeDetails(raw);
    });
}

export async function fetchPullRequestFiles(prNumber: number): Promise<PullRequestFile[]> {
    return withProvider<PullRequestFile[]>([], (provider, repoId) => provider.fetchFiles(repoId, prNumber));
}

/**
 * Both sides of one file, base64 as the providers return them. Each side is
 * null when the file does not exist at that commit (added on one side, deleted
 * on the other).
 */
export async function fetchPullRequestFileDiff(file: PullRequestFile, baseSha: string, headSha: string) {
    const empty: { original: string | null; modified: string | null } = { original: null, modified: null };

    return withProvider(empty, async (provider, repoId) => {
        const originalPath = file.previousPath || file.path;

        const [original, modified] = await Promise.all([
            file.status === 'added' ? Promise.resolve(null) : provider.fetchFileContent(repoId, originalPath, baseSha),
            file.status === 'removed' ? Promise.resolve(null) : provider.fetchFileContent(repoId, file.path, headSha),
        ]);

        return { original, modified };
    });
}

export async function fetchReactions(target: ReactionTarget): Promise<PRReaction[]> {
    return withProvider<PRReaction[]>([], (provider, repoId) =>
        provider.fetchReactions(repoId, target, currentUserLogin.value));
}

/**
 * Toggles the signed-in user's reaction: adds it, or removes it when the
 * caller passes the id of their existing one.
 */
export async function toggleReaction(target: ReactionTarget, content: string, existingId?: string | number | null) {
    return withProvider(false, (provider, repoId) => (existingId
        ? provider.removeReaction(repoId, target, existingId)
        : provider.addReaction(repoId, target, content)));
}

// Watchers para automação de carregamento
watch(repoPath, async (newPath, oldPath) => {
    if (newPath !== oldPath) {
        pullRequests.value = [];
        prError.value = null;
        lastLoadedPath = '';
        lastLoadedAt = 0;
        // A PR belongs to the repository it was opened from. Leaving the view
        // up after a repo switch showed one repo's pull request while every
        // request it made (files, comments, reactions) hit the other one.
        activePullRequest.value = null;
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

// The setting changes which states the provider asks for, so the cached list
// no longer answers the question: refetch. `visiblePullRequests` already
// narrowed the rendered list synchronously, this brings in the PRs that were
// never fetched (the closed ones) when the box is ticked.
watch(() => generalSettings.value.showClosedPRs, () => {
    if (repoPath.value) loadPullRequests(true);
});

import { ref, computed, watch } from 'vue';
import { repoPath, branches, isLoadingData, selectedLogRef, activeTab } from './gitService';
import { useIntegrations } from './integrations';

export interface PullRequest {
    id: string | number;
    number: number;
    title: string;
    body?: string;
    url: string;
    state: string;
    user: {
        login: string;
        avatar_url: string;
    };
    assignees?: { login: string; avatar_url: string }[];
    requestedReviewers?: { login: string; avatar_url: string }[];
    labels?: { name: string; color: string }[];
    sourceBranch: string;
    targetBranch: string;
    createdAt: string;
}

export const pullRequests = ref<PullRequest[]>([]);
export const isPRLoading = ref(false);
export const prError = ref<string | null>(null);

export const currentUserLogin = ref<string | null>(null);

const { getValidSession, list: integrationsList } = useIntegrations();

export async function loadPullRequests() {
    if (!repoPath.value || !window.gitbox) return;

    // Attempt to get user info if not set
    if (!currentUserLogin.value) {
        const gh = integrationsList.value.find(i => i.id === 'github' && i.connected);
        if (gh && gh.user) {
            currentUserLogin.value = (gh.user as any).login;
        }
    }

    // Find current branch
    // The user said "na branch selecionada", so let's try selectedLogRef first, then current branch
    let branchName = selectedLogRef.value;
    if (!branchName) {
        const currentBranch = branches.value.find(b => b.is_head);
        branchName = currentBranch?.name || '';
    }

    if (!branchName) return;

    isPRLoading.value = true;
    prError.value = null;
    try {
        // Try to identify the provider by remote URL
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl) return;

        if (remoteUrl.includes('github.com')) {
            await fetchGitHubPRs(remoteUrl);
        } else if (remoteUrl.includes('gitlab.com')) {
            // GitLab implementation later
        }
    } catch (e) {
        console.error('Failed to load PRs', e);
    } finally {
        isPRLoading.value = false;
    }
}

async function fetchGitHubPRs(remoteUrl: string) {
    const session = await getValidSession('github');
    if (!session?.accessToken) return;

    // Extract owner/repo from URL
    let repo = '';
    if (remoteUrl.includes('github.com:')) {
        repo = remoteUrl.split('github.com:')[1].replace('.git', '');
    } else {
        const parts = remoteUrl.split('github.com/')[1].split('/');
        repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
    }

    console.log(`[PullRequests] Fetching PRs for repo: ${repo}`);

    const response = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open&sort=updated&direction=desc`, {
        headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/json'
        }
    });

    if (response.ok) {
        const data = await response.json();
        pullRequests.value = data.map((pr: any) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            body: pr.body,
            url: pr.html_url,
            state: pr.state,
            user: {
                login: pr.user.login,
                avatar_url: pr.user.avatar_url
            },
            assignees: pr.assignees?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url })) || [],
            requestedReviewers: pr.requested_reviewers?.map((a: any) => ({ login: a.login, avatar_url: a.avatar_url })) || [],
            labels: pr.labels?.map((l: any) => ({ name: l.name, color: l.color })) || [],
            sourceBranch: pr.head.ref,
            targetBranch: pr.base.ref,
            createdAt: pr.created_at
        }));
    } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[PullRequests] API Error ${response.status}:`, errorData);
        if (response.status === 404) {
            prError.value = 'github_404';
            console.error(`[PullRequests] O repositório '${repo}' não foi encontrado. Se for um repositório privado, verifique se o GitHub App do GitBox está instalado na sua conta ou organização do GitHub com permissão para Pull Requests.`);
        }
    }
}

export async function createPullRequest() {
    activeTab.value = 'create_pr';
}

// Watch for changes to refresh PRs
watch(repoPath, () => {
    pullRequests.value = [];
    prError.value = null;
});

watch([repoPath, branches, selectedLogRef, isLoadingData], (newVals, oldVals) => {
    const isNowFinishedLoading = oldVals[3] === true && newVals[3] === false;
    const isJustDataChange = newVals[3] === false && oldVals[3] === false;

    if (isNowFinishedLoading || isJustDataChange) {
        loadPullRequests();
    }
});

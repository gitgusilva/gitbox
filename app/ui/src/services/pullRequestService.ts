import { ref, computed, watch } from 'vue';
import { repoPath, branches, isLoadingData, selectedLogRef, activeTab } from './gitService';
import { useIntegrations } from './integrations';
import { showToast } from './toastService';
import { isCreatePROpen } from './modalService';
import { generalSettings } from './settingsService';

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
    changed_files?: number;
    draft: boolean;
    nodeId: string;
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

    const stateParam = generalSettings.value.showClosedPRs ? 'all' : 'open';
    const response = await fetch(`https://api.github.com/repos/${repo}/pulls?state=${stateParam}&sort=updated&direction=desc`, {
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
            createdAt: pr.created_at,
            draft: pr.draft,
            nodeId: pr.node_id
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
    isCreatePROpen.value = true;
}

export async function closePullRequest(pr: PullRequest) {
    return updatePullRequest(pr, { state: 'closed' });
}

export async function convertPullRequestToDraft(pr: PullRequest) {
    if (!repoPath.value || !window.gitbox || !pr.nodeId) return false;
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return false;

        const session = await getValidSession('github');
        if (!session?.accessToken) return false;

        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: `mutation { convertPullRequestToDraft(input: {pullRequestId: "${pr.nodeId}"}) { clientMutationId } }`
            })
        });

        if (response.ok) {
            loadPullRequests();
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export async function updatePullRequest(pr: PullRequest, data: any) {
    if (!repoPath.value || !window.gitbox) return false;
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return false;

        const session = await getValidSession('github');
        if (!session?.accessToken) return false;

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const updated = await response.json();
            const index = pullRequests.value.findIndex(p => p.number === pr.number);
            if (index !== -1) {
                if (data.state) pullRequests.value[index].state = data.state;
                if (data.title) pullRequests.value[index].title = data.title;
                if (data.body !== undefined) pullRequests.value[index].body = data.body;
            }
            return true;
        } else {
            console.error(`[PullRequests] Failed to update PR ${response.status}`);
            return false;
        }
    } catch (e) {
        console.error('Failed to update PR', e);
        return false;
    }
}

export async function fetchPullRequestComments(pr: PullRequest) {
    if (!repoPath.value || !window.gitbox) return [];
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return [];
        const session = await getValidSession('github');
        if (!session?.accessToken) return [];

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        // Fetch both issue comments and review comments then merge
        const headers = { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json' };

        const [issueRes, reviewRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}/comments`, { headers }),
            fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/comments`, { headers })
        ]);

        let comments: any[] = [];
        if (issueRes.ok) comments = comments.concat(await issueRes.json());
        if (reviewRes.ok) comments = comments.concat(await reviewRes.json());

        // Process and sort
        return comments.map(c => ({
            id: c.id,
            body: c.body,
            user: { login: c.user.login, avatar_url: c.user.avatar_url },
            createdAt: c.created_at,
            url: c.html_url
        })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
        console.error('Failed to fetch PR comments', e);
        return [];
    }
}

export async function addPullRequestComment(pr: PullRequest, body: string) {
    if (!repoPath.value || !window.gitbox) return false;
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return false;

        const session = await getValidSession('github');
        if (!session?.accessToken) return false;

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}/comments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body })
        });

        return response.ok;
    } catch (e) {
        console.error('Failed to add PR comment', e);
        return false;
    }
}

export async function fetchPullRequestMetadata() {
    if (!repoPath.value || !window.gitbox) return { users: [], labels: [] };
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return { users: [], labels: [] };

        const session = await getValidSession('github');
        if (!session?.accessToken) return { users: [], labels: [] };

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        const headers = { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json' };

        const [usersRes, labelsRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${repo}/assignees?per_page=100`, { headers }),
            fetch(`https://api.github.com/repos/${repo}/labels?per_page=100`, { headers })
        ]);

        return {
            users: usersRes.ok ? await usersRes.json() : [],
            labels: labelsRes.ok ? await labelsRes.json() : []
        };
    } catch {
        return { users: [], labels: [] };
    }
}

export async function updatePullRequestReviewers(pr: PullRequest, reviewers: string[]) {
    // Note: GitHub API takes reviewers to be requested in one endpoint
    if (!repoPath.value || !window.gitbox) return false;
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return false;

        const session = await getValidSession('github');
        if (!session?.accessToken) return false;

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        // We need to request all new, since we can't easily sync without deleting old ones.
        // For simplicity we will request reviewers
        const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr.number}/requested_reviewers`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewers })
        });

        if (!response.ok) {
            try {
                const errorData = await response.json();
                if (errorData.message) {
                    showToast('Failed to update reviewers', errorData.message, 'error');
                } else {
                    showToast('Failed to update reviewers', `Status: ${response.status}`, 'error');
                }
            } catch {
                showToast('Failed to update reviewers', `Status: ${response.status}`, 'error');
            }
            return false;
        }

        // Refresh PR
        loadPullRequests();
        return true;
    } catch {
        showToast('Error', 'Failed to update reviewers', 'error');
        return false;
    }
}

export async function updatePullRequestAssigneesAndLabels(pr: PullRequest, assignees: string[], labels: string[]) {
    if (!repoPath.value || !window.gitbox) return false;
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return false;

        const session = await getValidSession('github');
        if (!session?.accessToken) return false;

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        // Patch PR issues endpoint for assignees and labels
        await fetch(`https://api.github.com/repos/${repo}/issues/${pr.number}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${session.accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignees, labels })
        });

        // Refresh PR
        loadPullRequests();
        return true;
    } catch {
        return false;
    }
}

export async function fetchPullRequestDetails(prNumber: number) {
    if (!repoPath.value || !window.gitbox) return null;
    try {
        const remoteUrl = await window.gitbox.getRemoteUrl(repoPath.value);
        if (!remoteUrl || !remoteUrl.includes('github.com')) return null;

        const session = await getValidSession('github');
        if (!session?.accessToken) return null;

        let repo = '';
        if (remoteUrl.includes('github.com:')) repo = remoteUrl.split('github.com:')[1].replace('.git', '');
        else {
            const parts = remoteUrl.split('github.com/')[1].split('/');
            repo = `${parts[0]}/${parts[1].replace('.git', '')}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch {
        return null;
    }
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

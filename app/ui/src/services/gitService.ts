import { ref, computed, shallowRef, watch } from 'vue';
import { getItem, setItem } from './storageService';
import { generalSettings } from './settingsService';
import { activeWorkspaceId, workspaces } from './workspaceService';
import {
    GitStatusEntry,
    Branch,
    Commit,
    Stash,
    FileDiff,
    TabKey
} from '../types/git';
import { branchActionModal } from './modalService';

export interface Submodule { path: string; sha: string; ref: string; status: string }

// State
export const repoPath = ref((generalSettings.value.rememberTabs ? getItem('gitbox_repo_path') : '') || '');
export const status = ref<GitStatusEntry[]>([]);
export const branches = ref<Branch[]>([]);
export const remotes = ref<string[]>([]);
export const tags = ref<{ name: string, target?: string }[]>([]);
export const stashes = ref<Stash[]>([]);
export const submodules = ref<Submodule[]>([]);
export const log = shallowRef<Commit[]>([]);
export const error = ref('');

export const activeTab = ref<TabKey>('history');
export const isTerminalOpen = ref(false);
export const selectedCommit = ref<Commit | null>(null);
export const selectedFile = ref<string>('');
export const selectedFiles = ref<string[]>([]);
export const selectedStash = ref<Stash | null>(null);
export const selectedStashFile = ref<string>('');
export const commitMessage = ref('');
export const userName = ref('');
export const userEmail = ref('');
export const isLoadingData = ref(false);
export const includeUntracked = ref(getItem('gitbox_include_untracked') !== 'false');

// Computed
export const unstagedFiles = computed(() => status.value.filter(s => {
    const isUntracked = s.status.includes('untracked') || s.status.includes('new');
    if (isUntracked && !includeUntracked.value) return false;
    return (isUntracked || s.status.includes('modified') || s.status.includes('deleted') || s.status.includes('conflicted')) && !s.status.startsWith('staged_');
}));
export const stagedFiles = computed(() => status.value.filter(s => s.status.startsWith('staged_')));
export const selectedLogRef = ref('');

// Sync with workspace
watch(() => {
    const ws = workspaces.value.find(w => w.id === activeWorkspaceId.value);
    return ws ? ws.path : null;
}, (newPath) => {
    if (newPath && newPath !== repoPath.value) {
        repoPath.value = newPath;

        // Reset local repo state
        selectedLogRef.value = '';
        selectedCommit.value = null;
        selectedFile.value = '';
        selectedFiles.value = [];

        loadRepoData(true);
    }
}, { immediate: true });

let pollingTimer: any = null;

// Actions
export async function loadRepoData(showLoader = false) {
    if (!repoPath.value.trim() || !window.gitbox) return;

    // We only show loader on critical manual refreshes or app start
    if (showLoader) isLoadingData.value = true;
    error.value = '';

    try {
        // Fetch light metadata always
        const [newStatus, newBranches, newRemotes, newTags, newStashes, newSubmodules, newConfig] = await Promise.all([
            window.gitbox.status(repoPath.value),
            window.gitbox.branches(repoPath.value),
            window.gitbox.remotes(repoPath.value),
            window.gitbox.tags(repoPath.value),
            window.gitbox.stashes(repoPath.value),
            window.gitbox.getSubmodules(repoPath.value),
            window.gitbox.getConfig(repoPath.value)
        ]);

        status.value = newStatus;
        branches.value = newBranches;
        remotes.value = newRemotes;
        tags.value = newTags;
        stashes.value = newStashes;
        submodules.value = newSubmodules;
        userName.value = newConfig ? newConfig.userName : '';
        userEmail.value = newConfig ? newConfig.userEmail : '';

        // Optimization: Only fetch the heavy log if it's the first time, 
        // or a manual refresh was requested, or if the active tab is 'history'.
        // This avoids hammering the CPU with git logs every 5s in the background.
        if (showLoader || activeTab.value === 'history' || log.value.length === 0) {
            const newLog = await window.gitbox.log(repoPath.value, generalSettings.value.historyCount, selectedLogRef.value || 'ALL');
            log.value = newLog;
        }

        if (status.value.length > 0 && !selectedFile.value) {
            selectedFile.value = status.value[0].path;
        }
    } catch (err) {
        error.value = String(err);
    } finally {
        if (showLoader) isLoadingData.value = false;
    }
}

let lastManualRefresh = 0;

/**
 * Start a controlled background refresh that only runs when the window is active.
 */
export function startPolling() {
    if (pollingTimer) clearTimeout(pollingTimer);

    const poll = async () => {
        const interval = generalSettings.value.autoFetchInterval;

        // If interval is 0, we don't do background fetch. 
        // We still might want to poll status every 1 min for UI responsiveness, 
        // but let's follow the "0 removes the auto fetch" literally for now.
        if (interval > 0 && !document.hidden && !isLoading.value && repoPath.value) {
            try {
                // Perform the actual git fetch
                await window.gitbox.fetch(repoPath.value);
                await loadRepoData();
                lastManualRefresh = Date.now();
            } catch (e) {
                // Background fetch failed, ignore
            }
        } else if (interval === 0 && !document.hidden && !isLoading.value && repoPath.value) {
            // Even if auto-fetch is off, we refresh the UI status every 1 min 
            // so the user sees local file changes.
            await loadRepoData();
            lastManualRefresh = Date.now();
        }

        // Poll again after the specified interval (at least 1 min for UI status)
        const nextTick = interval > 0 ? interval * 60000 : 60000;
        pollingTimer = setTimeout(poll, nextTick);
    };

    // Immediate refresh when coming back from background, but with a 10s cooldown
    window.addEventListener('focus', () => {
        const now = Date.now();
        if (now - lastManualRefresh > 10000 && !isLoading.value && repoPath.value) {
            loadRepoData();
            lastManualRefresh = now;

            // Reset the timer
            if (pollingTimer) clearTimeout(pollingTimer);
            const interval = generalSettings.value.autoFetchInterval;
            const nextTick = interval > 0 ? interval * 60000 : 60000;
            pollingTimer = setTimeout(poll, nextTick);
        }
    });

    const initialTick = generalSettings.value.autoFetchInterval > 0
        ? generalSettings.value.autoFetchInterval * 60000
        : 60000;
    pollingTimer = setTimeout(poll, initialTick);
}

// Watch for interval changes and restart polling
watch(() => generalSettings.value.autoFetchInterval, () => {
    startPolling();
});

export async function openRepo() {
    if (!window.gitbox) return;
    const path = await window.gitbox.selectFolder();
    if (path) {
        repoPath.value = path;
        if (generalSettings.value.rememberTabs) {
            setItem('gitbox_repo_path', path);
        }
        await loadRepoData(true);
    }
}

export const isLoading = ref(false);

async function runAction(action: () => unknown, showLoader = false) {
    isLoading.value = true;
    try {
        await action();
        // After an action, always refresh everything immediately
        await loadRepoData(showLoader || true);
    } catch (err) {
        error.value = String(err);
    } finally {
        isLoading.value = false;
    }
}

export const stageAll = () => runAction(() => window.gitbox.stageAll(repoPath.value));
export const stageFile = (path: string) => runAction(() => window.gitbox.stageFile(repoPath.value, path));
export const unstageAll = () => runAction(() => window.gitbox.unstageAll(repoPath.value));
export const unstageFile = (path: string) => runAction(() => window.gitbox.unstageFile(repoPath.value, path));
export const discardAll = () => runAction(() => window.gitbox.discardAll(repoPath.value));
export const discardFile = (path: string) => runAction(() => window.gitbox.discardFile(repoPath.value, path));
export const doFetch = () => runAction(() => window.gitbox.fetch(repoPath.value));
export const doPull = () => runAction(() => window.gitbox.pull(repoPath.value));
export const doPush = () => runAction(() => window.gitbox.push(repoPath.value));

export const setGitConfig = async (name: string, email: string) => {
    if (!window.gitbox) return;
    await runAction(() => window.gitbox.setConfig(repoPath.value, name, email));
};

export const toggleTerminal = () => {
    isTerminalOpen.value = !isTerminalOpen.value;
};

export const checkoutBranch = async (name: string) => {
    isLoading.value = true;
    try {
        await window.gitbox.checkoutBranch(repoPath.value, name);
        await loadRepoData(true);
    } catch (err: any) {
        if (err.message && err.message.includes('conflicts prevent checkout')) {
            const hasChanges = unstagedFiles.value.length > 0 || stagedFiles.value.length > 0;
            branchActionModal.value = {
                type: 'checkout_conflict',
                targetBranch: name,
                hasChanges,
                onConfirm: async (action) => {
                    await handleBranchActionFlow(action, async () => {
                        await window.gitbox.checkoutBranch(repoPath.value, name);
                    });
                }
            };
        } else {
            error.value = String(err);
        }
    } finally {
        isLoading.value = false;
    }
};

export const createBranchAction = () => {
    const hasChanges = unstagedFiles.value.length > 0 || stagedFiles.value.length > 0;
    branchActionModal.value = {
        type: 'create_branch',
        hasChanges,
        onConfirm: async (action, newName) => {
            if (!newName) return;
            await handleBranchActionFlow(action, async () => {
                await window.gitbox.createBranch(repoPath.value, newName);
            });
        }
    };
};

async function handleBranchActionFlow(action: 'stash' | 'discard' | 'keep', coreTask: () => Promise<void>) {
    isLoading.value = true;
    try {
        if (action === 'discard') {
            await window.gitbox.discardAll(repoPath.value);
            await coreTask();
        } else if (action === 'stash') {
            await window.gitbox.stashSave(repoPath.value, 'Auto-stash before branch switch');
            await coreTask();
            try {
                // Wait briefly for FS before popping
                await new Promise(r => setTimeout(r, 500));
                await window.gitbox.stashPop(repoPath.value, '');
            } catch (e) {
                error.value = 'Failed to pop stash automatically: ' + String(e);
            }
        } else {
            // keep
            await coreTask();
        }
        await loadRepoData(true);
    } catch (err: any) {
        error.value = String(err);
    } finally {
        isLoading.value = false;
    }
}
export const commitAll = async () => {
    if (!commitMessage.value.trim()) return;
    await runAction(() => window.gitbox.commitAll(repoPath.value, commitMessage.value.trim()));
    commitMessage.value = '';
};

export const deleteBranch = (name: string) => runAction(() => window.gitbox.deleteBranch(repoPath.value, name));
export const stashPop = (stashId?: string) => runAction(() => window.gitbox.stashPop(repoPath.value, stashId));
export const dropStash = (stashId?: string) => runAction(() => window.gitbox.stashDrop(repoPath.value, stashId));


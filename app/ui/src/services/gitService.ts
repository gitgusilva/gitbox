import { ref, computed, shallowRef, watch } from 'vue';
import { getItem, setItem } from './storageService';
import { generalSettings } from './settingsService';
import { activeWorkspaceId, workspaces, removeWorkspace, updateWorkspace } from './workspaceService';
import {
    GitStatusEntry,
    Branch,
    Commit,
    Stash,
    FileDiff,
    TabKey
} from '../types/git';
import { branchActionModal } from './modalService';
import { addLog } from './logService';

/**
 * Represents a Git submodule entry.
 */
export interface Submodule {
    /** Relative path to the submodule. */
    path: string;
    /** Current commit SHA of the submodule. */
    sha: string;
    /** Branch or ref tracked by the submodule. */
    ref: string;
    /** Current status string. */
    status: string;
}

// State
/** The absolute path of the currently open repository. */
export const repoPath = ref((generalSettings.value.rememberTabs ? getItem('gitbox_repo_path') : '') || '');

// These are large, read-only data arrays replaced wholesale on each load.
// Using shallowRef avoids Vue deep-proxying thousands of objects (a repo with
// ~2.7k branches froze the renderer while wrapping every branch in a reactive
// proxy and re-reading them through proxy traps during render).
/** List of modified/untracked files in the current repository. */
export const status = shallowRef<GitStatusEntry[]>([]);

/** Available branches in the repository. */
export const branches = shallowRef<Branch[]>([]);

/** Remotes configured for the repository. */
export const remotes = shallowRef<string[]>([]);

/** Tags found in the repository. */
export const tags = shallowRef<{ name: string, target?: string }[]>([]);

/** Current stash entries. */
export const stashes = shallowRef<Stash[]>([]);

/** Submodules found in the repository. */
export const submodules = shallowRef<Submodule[]>([]);

/** The commit log history (loaded incrementally, page by page). */
export const log = shallowRef<Commit[]>([]);

/** Incremental log pagination (SourceGit/GitKraken-style: load a page, fetch more on scroll). */
const LOG_PAGE_SIZE = 300;
export const logHasMore = ref(false);
export const isLoadingMoreLog = ref(false);

/** Loads the first page of the commit log, resetting pagination. */
export async function loadInitialLog() {
    if (!repoPath.value.trim() || !window.gitbox) return;
    const cap = generalSettings.value.historyCount || LOG_PAGE_SIZE;
    const count = Math.min(LOG_PAGE_SIZE, cap);
    const page = await window.gitbox.log(repoPath.value, count, selectedLogRef.value || 'ALL', 0);
    log.value = page;
    logHasMore.value = page.length === count && page.length < cap;
}

/** Appends the next page of commits (called when the user scrolls near the end). */
export async function loadMoreLog() {
    if (!logHasMore.value || isLoadingMoreLog.value || !repoPath.value.trim() || !window.gitbox) return;
    isLoadingMoreLog.value = true;
    try {
        const cap = generalSettings.value.historyCount || LOG_PAGE_SIZE;
        const skip = log.value.length;
        const count = Math.min(LOG_PAGE_SIZE, cap - skip);
        if (count <= 0) { logHasMore.value = false; return; }
        const page = await window.gitbox.log(repoPath.value, count, selectedLogRef.value || 'ALL', skip);
        if (page.length > 0) log.value = [...log.value, ...page];
        logHasMore.value = page.length === count && log.value.length < cap;
    } catch (e) {
        logHasMore.value = false;
    } finally {
        isLoadingMoreLog.value = false;
    }
}

/**
 * Applies a changed `historyCount` cap without a full repo reload. Growing the
 * cap just re-enables paging (more loads as you scroll); shrinking it trims the
 * tail. This avoids the jarring reset-to-300 + scroll jump that a full
 * loadRepoData caused when the user only bumped the commit count.
 */
export function refreshLogCap() {
    const cap = generalSettings.value.historyCount || LOG_PAGE_SIZE;
    if (log.value.length > cap) log.value = log.value.slice(0, cap);
    logHasMore.value = log.value.length < cap;
}

/** Global error message for Git operations. */
export const error = ref('');

/** Currently active UI tab in the workspace. */
export const activeTab = ref<TabKey>('history');

/** Repository state: 'clean' | 'merge' | 'rebase' | ... — drives the MERGING banner. */
export const repoState = ref<import('../types/git').RepoState>('clean');

/** Name of the branch currently checked out (HEAD), or '' if detached/unknown. */
export const currentBranchName = computed(() => branches.value.find(b => b.is_head)?.name || '');

/** Indicates if the integrated terminal is visible. */
export const isTerminalOpen = ref(false);

/** List of commits currently selected in the UI. */
export const selectedCommits = ref<Commit[]>([]);

/** 
 * Helper computed for the primary selected commit.
 * @see selectedCommits
 */
export const selectedCommit = computed({
    get: () => selectedCommits.value[0] || null,
    set: (val: Commit | null) => { selectedCommits.value = val ? [val] : []; }
});

/** Path of the currently selected file in the diff/changes view. */
export const selectedFile = ref<string>('');

/** Multiple files selected for staging/discarding. */
export const selectedFiles = ref<string[]>([]);

/** Stash currently selected for preview. */
export const selectedStash = ref<Stash | null>(null);

/** Specific file selected within a stash preview. */
export const selectedStashFile = ref<string>('');

/** Pending commit message. */
export const commitMessage = ref('');

/** Git user name from config. */
export const userName = ref('');

/** Git user email from config. */
export const userEmail = ref('');

/** Indicates if the app is performing a heavy data load operation. */
export const isLoadingData = ref(false);

/** Setting to include or hide untracked files in the status list. */
export const includeUntracked = ref(getItem('gitbox_include_untracked') !== 'false');

// Computed
/** Files that are modified but NOT staged. */
export const unstagedFiles = computed(() => status.value.filter(s => {
    const isUntracked = s.status.includes('untracked') || s.status.includes('new');
    if (isUntracked && !includeUntracked.value) return false;
    return (isUntracked || s.status.includes('modified') || s.status.includes('deleted') || s.status.includes('conflicted')) && !s.status.startsWith('staged_');
}));

/** Files that are currently staged. */
export const stagedFiles = computed(() => status.value.filter(s => s.status.startsWith('staged_')));

/** Specific ref (branch/tag) used to filter the history log. */
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
/**
 * Loads all repository data from the backend.
 * 
 * @param showLoader - If true, sets the global `isLoadingData` to show a UI spinner.
 * @param targetWorkspaceId - Optional ID of the workspace to sync if different from active.
 * 
 * @example
 * ```typescript
 * await loadRepoData(true);
 * ```
 */
export async function loadRepoData(showLoader = false, targetWorkspaceId?: string) {
    if (!repoPath.value.trim() || !window.gitbox) return;

    // We only show loader on critical manual refreshes or app start
    if (showLoader) isLoadingData.value = true;
    error.value = '';

    const rp = repoPath.value;
    try {
        // Fetch light metadata in parallel.
        const [newStatus, newBranches, newRemotes, newTags, newStashes, newSubmodules, newConfig, newState] = await Promise.all([
            window.gitbox.status(rp),
            window.gitbox.branches(rp),
            window.gitbox.remotes(rp),
            window.gitbox.tags(rp),
            window.gitbox.stashes(rp),
            window.gitbox.getSubmodules(rp),
            window.gitbox.getConfig(rp),
            window.gitbox.repoState ? window.gitbox.repoState(rp) : Promise.resolve('clean')
        ]);

        status.value = newStatus;
        branches.value = newBranches;
        remotes.value = newRemotes;
        tags.value = newTags;
        stashes.value = newStashes;
        submodules.value = newSubmodules;
        repoState.value = (newState as import('../types/git').RepoState) || 'clean';
        userName.value = newConfig ? newConfig.userName : '';
        userEmail.value = newConfig ? newConfig.userEmail : '';

        // Load only the FIRST page of the log (the rest streams in on scroll).
        // Skip on background polls so we don't reset the loaded pages / jump to top;
        // new commits show on manual refresh or repo/ref switch.
        if (showLoader || log.value.length === 0) {
            await loadInitialLog();
        }

        if (status.value.length > 0 && !selectedFile.value) {
            selectedFile.value = status.value[0].path;
        }
    } catch (err: any) {
        error.value = String(err);
        if (error.value.includes('failed to resolve path') || error.value.includes('No such file or directory')) {
            const idToReset = targetWorkspaceId || activeWorkspaceId.value;
            if (idToReset) {
                updateWorkspace(idToReset, { name: '', path: '' });
                const { showToast } = await import('./toastService');
                showToast('Error', 'Repository path not found. Current tab reset.', 'error');
            }
        }
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
            // Auto-fetch off: only re-read the working-tree status so the user sees
            // local file changes. No need for the full 8-IPC repo reload every minute.
            await refreshStatus();
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

/** Light refresh: re-reads only the working-tree status. */
export async function refreshStatus() {
    if (!repoPath.value.trim() || !window.gitbox) return;
    try {
        status.value = await window.gitbox.status(repoPath.value);
    } catch {
        /* ignore — a transient status read failure shouldn't surface as an error */
    }
}

/**
 * Runs a git action then refreshes. `refresh` decides how much:
 *  - 'status' (default): re-read only the file status — for stage/unstage/discard,
 *    which don't touch branches/tags/stashes. Avoids the 8-IPC + full-log-reload
 *    storm (and the graph rebuild it triggered) on every single-file operation.
 *  - 'full': reload the whole repo — for commit/checkout/branch/remote/sync ops.
 */
async function runAction(action: () => unknown, refresh: 'status' | 'full' = 'status', actionName?: string, showLoader = false) {
    isLoading.value = true;
    try {
        await action();
        if (actionName) {
            addLog(actionName, 'Action', 'success');
        }
        if (refresh === 'full') {
            await loadRepoData(showLoader);
        } else {
            await refreshStatus();
        }
    } catch (err: any) {
        error.value = String(err);
        if (actionName) {
            addLog(`Failed: ${actionName}`, 'Action', 'error', { details: String(err) });
        }
    } finally {
        isLoading.value = false;
    }
}

export const stageAll = () => runAction(() => window.gitbox.stageAll(repoPath.value), 'status', "Stage all changes");
export const stageFile = (path: string) => runAction(() => window.gitbox.stageFile(repoPath.value, path), 'status', `Stage file ${path}`);
export const unstageAll = () => runAction(() => window.gitbox.unstageAll(repoPath.value), 'status', "Unstage all changes");
export const unstageFile = (path: string) => runAction(() => window.gitbox.unstageFile(repoPath.value, path), 'status', `Unstage file ${path}`);
export const discardAll = () => runAction(() => window.gitbox.discardAll(repoPath.value), 'status', "Discard all changes");
export const discardFile = (path: string) => runAction(() => window.gitbox.discardFile(repoPath.value, path), 'status', `Discard file ${path}`);
export const doFetch = () => runAction(() => window.gitbox.fetch(repoPath.value), 'full', "Fetch from remote", true);
export const doPull = () => runAction(() => window.gitbox.pull(repoPath.value), 'full', "Pull from remote", true);

import { isPushModalOpen } from './modalService';

export const doPush = () => {
    isPushModalOpen.value = true;
};

export const confirmPush = (remoteName?: string, branchName?: string, setUpstream?: boolean, force?: boolean, pushTags?: boolean) => {
    return runAction(async () => {
        isPushModalOpen.value = false;
        await window.gitbox.push(repoPath.value, remoteName, branchName, setUpstream, force, pushTags);
    }, 'full', `Push to ${remoteName || 'origin'}/${branchName || ''}`, true);
};

export const setGitConfig = async (name: string, email: string) => {
    if (!window.gitbox) return;
    await runAction(() => window.gitbox.setConfig(repoPath.value, name, email), 'full', "Update Git Config", true);
};

export const toggleTerminal = () => {
    isTerminalOpen.value = !isTerminalOpen.value;
};

export const checkoutBranch = async (name: string) => {
    isLoading.value = true;
    try {
        let branchToCheckout = name;

        // Check if it's a remote branch
        const remoteBranch = branches.value.find(b => b.name === name && b.is_remote);
        if (remoteBranch) {
            // Strip remote prefix (e.g., origin/main -> main)
            const parts = name.split('/');
            if (parts.length > 1) {
                const localName = parts.slice(1).join('/');
                // Check if local branch already exists
                const localExists = branches.value.find(b => b.name === localName && !b.is_remote);
                if (localExists) {
                    branchToCheckout = localName;
                } else {
                    // Create local branch tracking remote
                    await window.gitbox.createBranch(repoPath.value, localName, name);
                    branchToCheckout = localName;
                }
            }
        }

        await window.gitbox.checkoutBranch(repoPath.value, branchToCheckout);
        await loadRepoData(true);
        addLog(`Checked out branch ${branchToCheckout}`, 'Action', 'success');
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

/**
 * Merge a branch into the current branch via libgit2. On conflicts, switches to
 * the Local Changes tab so the user can resolve them (and complete the merge).
 */
export const mergeBranchAction = async (name: string) => {
    if (!repoPath.value || !name) return;
    isLoading.value = true;
    try {
        const result = await window.gitbox.mergeBranch(repoPath.value, name);
        await loadRepoData(true);
        const { showToast } = await import('./toastService');

        if (result.status === 'up_to_date') {
            showToast('Merge', `Already up to date with ${name}.`, 'info');
        } else if (result.status === 'fast_forward') {
            showToast('Merge', `Fast-forwarded to ${name}.`, 'success');
        } else if (result.status === 'merged') {
            showToast('Merge', `Merged ${name} into ${currentBranchName.value}.`, 'success');
        } else if (result.status === 'conflicts') {
            const count = result.conflicts?.length || 0;
            activeTab.value = 'local_changes';
            showToast('Merge conflicts', `${count} file(s) conflict. Resolve them, then complete the merge.`, 'error');
        }
        addLog(`Merge ${name}: ${result.status}`, 'Action', result.status === 'conflicts' ? 'error' : 'success');
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Merge failed', error.value, 'error');
    } finally {
        isLoading.value = false;
    }
};

/** Finalize an in-progress merge (after conflicts are resolved + staged). */
export const completeMergeAction = async (message?: string) => {
    if (!repoPath.value) return;
    isLoading.value = true;
    try {
        const msg = message || (currentBranchName.value ? `Merge into ${currentBranchName.value}` : 'Merge');
        await window.gitbox.mergeContinue(repoPath.value, msg);
        await loadRepoData(true);
        const { showToast } = await import('./toastService');
        showToast('Merge', 'Merge completed.', 'success');
        addLog('Merge completed', 'Action', 'success');
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Merge failed', error.value, 'error');
    } finally {
        isLoading.value = false;
    }
};

/** Abort an in-progress merge: hard-reset to HEAD and clear merge state. */
export const abortMergeAction = async () => {
    if (!repoPath.value) return;
    isLoading.value = true;
    try {
        await window.gitbox.mergeAbort(repoPath.value);
        await loadRepoData(true);
        const { showToast } = await import('./toastService');
        showToast('Merge', 'Merge aborted.', 'info');
        addLog('Merge aborted', 'Action', 'info');
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Abort failed', error.value, 'error');
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
            addLog(`Creating branch ${newName} with ${action} policy`, 'Action', 'info');
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
        addLog(`Successfully completed branch action: ${action}`, 'Action', 'success');
    } catch (err: any) {
        error.value = String(err);
        addLog(`Failed branch action: ${action}`, 'Action', 'error', { details: String(err) });
    } finally {
        isLoading.value = false;
    }
}
export const commitAll = async () => {
    if (!commitMessage.value.trim()) return;
    await runAction(() => window.gitbox.commitAll(repoPath.value, commitMessage.value.trim()), 'full', "Commit changes", true);
    commitMessage.value = '';
};

export const deleteBranch = (name: string) => runAction(() => window.gitbox.deleteBranch(repoPath.value, name), 'full', `Delete branch ${name}`, true);
export const stashPop = (stashId?: string) => runAction(() => window.gitbox.stashPop(repoPath.value, stashId), 'full', "Pop stash", true);
export const dropStash = (stashId?: string) => runAction(() => window.gitbox.stashDrop(repoPath.value, stashId), 'full', "Drop stash", true);


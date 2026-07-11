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
    const page = await window.gitbox.log(repoPath.value, count, logRefArg(), 0);
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
        const page = await window.gitbox.log(repoPath.value, count, logRefArg(), skip);
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
// The commit message is per-repository: when the active repo changes, stash the
// current draft under the old repo and restore the new repo's draft, instead of
// sharing one global message across every repo.
const commitDrafts = new Map<string, string>();
watch(repoPath, (newPath, oldPath) => {
    if (oldPath) commitDrafts.set(oldPath, commitMessage.value);
    commitMessage.value = newPath ? (commitDrafts.get(newPath) ?? '') : '';
});

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

/**
 * Branches/tags the history/graph is filtered to (SourceGit-style: a funnel toggle
 * per ref in the sidebar). Empty = show the WHOLE graph (ALL). The native log takes
 * them '\n'-joined and yields their sorted union. Persisted per-repo.
 */
export const selectedLogRefs = ref<string[]>([]);

// Whether the filter is the automatic "follow the checked-out branch" default
// (true) or a selection the user deliberately made (false). In auto mode the
// filter is re-seeded to the current branch on repo open and after a checkout;
// once the user toggles/clears a ref it becomes custom and is left untouched.
const logFilterAuto = ref(true);

/** Alias the badges bar / highlights read — just the active filter set. */
export const effectiveLogRefs = computed<string[]>(() => selectedLogRefs.value);

/** Back-compat single-value view for read-only consumers (PR branch context). */
export const selectedLogRef = computed(() => selectedLogRefs.value[0] || currentBranchName.value || '');

/** Value passed to the native log: '\n'-joined refs, or 'ALL' when unfiltered. */
function logRefArg(): string {
    return selectedLogRefs.value.length ? selectedLogRefs.value.join('\n') : 'ALL';
}

/** Toggle a ref in/out of the history filter (sidebar funnel icon). */
export function toggleLogFilter(name: string) {
    if (!name) return;
    logFilterAuto.value = false; // any manual toggle makes the filter user-owned
    selectedLogRefs.value = selectedLogRefs.value.includes(name)
        ? selectedLogRefs.value.filter(r => r !== name)
        : [...selectedLogRefs.value, name];
}

/** Remove one ref from the filter (badge ✕). Empty filter = whole graph. */
export function removeLogFilter(name: string) {
    logFilterAuto.value = false;
    selectedLogRefs.value = selectedLogRefs.value.filter(r => r !== name);
}

/** Clear the entire filter (show the whole graph). */
export function clearLogFilter() {
    logFilterAuto.value = false;
    selectedLogRefs.value = [];
}

/**
 * In auto mode, keep the history filter focused on the checked-out branch. Called
 * from loadRepoData once branches are loaded, so it runs on first repo open and
 * after every checkout. No-op when the user has customized the filter, when the
 * branch is unknown (detached HEAD), or when it already matches (avoids a needless
 * log reload). Returns true if it changed the filter.
 */
function syncAutoLogFilter(): boolean {
    if (!logFilterAuto.value) return false;
    const cur = currentBranchName.value;
    if (!cur) return false;
    if (selectedLogRefs.value.length === 1 && selectedLogRefs.value[0] === cur) return false;
    selectedLogRefs.value = [cur];
    return true;
}

// --- Per-repo persistence: the history filter is remembered and restored every
// time the user returns to a repo (like the expanded sidebar folders). ---
const LOG_FILTER_KEY = 'gitbox_log_filter';

function loadLogFilter(rp: string): { refs: string[]; auto: boolean } {
    // No saved entry → auto mode (defaults to the checked-out branch). `auto`
    // defaults to true for older saved entries that predate the flag.
    if (!rp) return { refs: [], auto: true };
    try {
        const all = JSON.parse(getItem(LOG_FILTER_KEY) || '{}');
        const v = all[rp];
        if (!v) return { refs: [], auto: true };
        return {
            refs: Array.isArray(v.refs) ? v.refs : [],
            auto: v.auto !== false,
        };
    } catch {
        return { refs: [], auto: true };
    }
}

function persistLogFilter() {
    const rp = repoPath.value;
    if (!rp) return;
    try {
        const all = JSON.parse(getItem(LOG_FILTER_KEY) || '{}');
        all[rp] = { refs: selectedLogRefs.value, auto: logFilterAuto.value };
        setItem(LOG_FILTER_KEY, JSON.stringify(all));
    } catch {
        /* ignore persistence errors */
    }
}

watch(selectedLogRefs, persistLogFilter, { deep: true });

// Sync with workspace: on repo switch, restore that repo's saved history filter.
// The actual current-branch seeding (auto mode) happens in loadRepoData once the
// branch list is available — here we only restore refs + the auto/custom flag.
watch(() => {
    const ws = workspaces.value.find(w => w.id === activeWorkspaceId.value);
    return ws ? ws.path : null;
}, (newPath) => {
    if (newPath && newPath !== repoPath.value) {
        repoPath.value = newPath;

        // Restore this repo's saved history filter. Auto mode (default / no saved
        // entry) is re-focused to the checked-out branch in loadRepoData.
        const savedFilter = loadLogFilter(newPath);
        logFilterAuto.value = savedFilter.auto;
        selectedLogRefs.value = savedFilter.refs;
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

        // In auto mode, focus the history on the just-loaded checked-out branch.
        // Runs on first open (seeds the current branch) and after a checkout
        // (follows to the new branch). No-op when the user customized the filter.
        // Done before loadInitialLog so the first page already reflects the filter.
        syncAutoLogFilter();

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
/** Once a repo has no conflicts left, close any standalone merge windows for it. */
function closeMergeWindowsIfResolved() {
    const hasConflicts = status.value.some((f: any) => String(f?.status || '').toLowerCase().includes('conflict'));
    if (!hasConflicts && repoPath.value) {
        (window as any).gitbox?.closeMergeWindows?.(repoPath.value);
    }
}

export const completeMergeAction = async (message?: string) => {
    if (!repoPath.value) return;
    isLoading.value = true;
    try {
        const msg = message || (currentBranchName.value ? `Merge into ${currentBranchName.value}` : 'Merge');
        await window.gitbox.mergeContinue(repoPath.value, msg);
        await loadRepoData(true);
        closeMergeWindowsIfResolved();
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
        closeMergeWindowsIfResolved();
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

/** Rebase controls (abort / skip / continue), mirroring the merge-abort flow. */
const runRebaseAction = async (
    op: 'rebaseAbort' | 'rebaseSkip' | 'rebaseContinue',
    okMsg: string,
) => {
    if (!repoPath.value || !window.gitbox) return;
    isLoading.value = true;
    try {
        await (window.gitbox as any)[op](repoPath.value);
        await loadRepoData(true);
        closeMergeWindowsIfResolved();
        const { showToast } = await import('./toastService');
        showToast('Rebase', okMsg, 'info');
        addLog(okMsg, 'Action', 'info');
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Rebase failed', error.value, 'error');
    } finally {
        isLoading.value = false;
    }
};

export const rebaseAbortAction = () => runRebaseAction('rebaseAbort', 'Rebase aborted.');
export const rebaseSkipAction = () => runRebaseAction('rebaseSkip', 'Patch skipped.');
export const rebaseContinueAction = () => runRebaseAction('rebaseContinue', 'Rebase continued.');

/** Apply a commit onto the current branch. Routes conflicts to the banner. */
export const cherryPickAction = async (sha: string) => {
    if (!repoPath.value || !window.gitbox || !sha) return;
    isLoading.value = true;
    try {
        const result = await window.gitbox.cherryPick(repoPath.value, sha);
        await loadRepoData(true);
        const { showToast } = await import('./toastService');
        if (result.status === 'conflicts') {
            activeTab.value = 'local_changes';
            showToast('Cherry-pick conflicts', 'Resolve the conflicts, then continue the cherry-pick.', 'error');
        } else {
            showToast('Cherry-pick', `Applied ${sha.substring(0, 7)}.`, 'success');
        }
        addLog(`Cherry-pick ${sha.substring(0, 7)}: ${result.status}`, 'Action', result.status === 'conflicts' ? 'error' : 'success');
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Cherry-pick failed', error.value, 'error');
    } finally {
        isLoading.value = false;
    }
};

/** Cherry-pick controls (abort / skip / continue), mirroring the rebase flow. */
const runCherryPickAction = async (
    op: 'cherryPickAbort' | 'cherryPickSkip' | 'cherryPickContinue',
    okMsg: string,
) => {
    if (!repoPath.value || !window.gitbox) return;
    isLoading.value = true;
    try {
        const result = await (window.gitbox as any)[op](repoPath.value);
        await loadRepoData(true);
        closeMergeWindowsIfResolved();
        const { showToast } = await import('./toastService');
        if (result && result.status === 'conflicts') {
            activeTab.value = 'local_changes';
            showToast('Cherry-pick conflicts', 'Still conflicts to resolve before continuing.', 'error');
        } else {
            showToast('Cherry-pick', okMsg, 'info');
        }
        addLog(okMsg, 'Action', 'info');
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Cherry-pick failed', error.value, 'error');
    } finally {
        isLoading.value = false;
    }
};

export const cherryPickAbortAction = () => runCherryPickAction('cherryPickAbort', 'Cherry-pick aborted.');
export const cherryPickSkipAction = () => runCherryPickAction('cherryPickSkip', 'Commit skipped.');
export const cherryPickContinueAction = () => runCherryPickAction('cherryPickContinue', 'Cherry-pick continued.');

/**
 * Open the conflicted file in the configured merge tool. Routes by the
 * `externalMergeTool` setting: the built-in GitBox merge editor (default), or
 * the external tool configured in Preferences. Targets the currently selected
 * conflicted file, falling back to the first conflict in the working tree.
 */
export const manualMergeAction = async () => {
    if (!repoPath.value || !window.gitbox) return;
    const isConflicted = (s: string) => (s || '').toLowerCase().includes('conflicted');

    // The merge editor only makes sense for content conflicts (both sides modified
    // the file, UU/AA). Delete/add conflicts have no content on one side and can't
    // be resolved in the editor — skip them and tell the user.
    let types: Record<string, string> = {};
    try { types = (await (window as any).gitbox.conflictTypes?.(repoPath.value)) || {}; } catch { /* ignore */ }
    const isContent = (p: string) => types[p] === 'UU' || types[p] === 'AA';
    const conflicted = status.value.filter(f => isConflicted(f.status)).map(f => f.path);

    const target = (selectedFile.value && conflicted.includes(selectedFile.value) && isContent(selectedFile.value))
        ? selectedFile.value
        : conflicted.find(isContent);
    if (!target) {
        const { showToast } = await import('./toastService');
        showToast('Merge', 'No content conflicts to merge in the editor. Resolve deleted/added files from the conflict panel.', 'info');
        return;
    }

    const tool = generalSettings.value.externalMergeTool;
    const useExternal = !!tool && tool !== 'gitbox' && tool !== 'none' && tool !== 'custom';
    try {
        if (useExternal) {
            await window.gitbox.openMergeTool(repoPath.value, target, tool === 'git_config_default' ? undefined : tool);
            await loadRepoData();
        } else {
            await window.gitbox.openMergeWindow(repoPath.value, target);
        }
    } catch (err: any) {
        error.value = String(err?.message || err);
        const { showToast } = await import('./toastService');
        showToast('Merge tool failed', error.value, 'error');
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
/** When true, the next commit amends the previous one (git commit --amend). */
export const amendLast = ref(false);

export const commitAll = async () => {
    const msg = commitMessage.value.trim();
    if (amendLast.value) {
        // Amend: message optional — empty keeps the previous message (--no-edit).
        await runAction(() => window.gitbox.commitAmend(repoPath.value, msg || undefined), 'full', "Amend last commit", true);
    } else {
        if (!msg) return;
        await runAction(() => window.gitbox.commitAll(repoPath.value, msg), 'full', "Commit changes", true);
    }
    commitMessage.value = '';
    amendLast.value = false;
    closeMergeWindowsIfResolved();
};

export const deleteBranch = (name: string) => runAction(() => window.gitbox.deleteBranch(repoPath.value, name), 'full', `Delete branch ${name}`, true);
export const renameBranch = (oldName: string, newName: string) => runAction(() => window.gitbox.renameBranch(repoPath.value, oldName, newName), 'full', `Rename branch ${oldName} → ${newName}`, true);
export const deleteTag = (name: string) => runAction(() => window.gitbox.deleteTag(repoPath.value, name), 'full', `Delete tag ${name}`, true);
export const resetToCommit = (sha: string, mode: 'soft' | 'mixed' | 'hard') => runAction(() => window.gitbox.resetToCommit(repoPath.value, sha, mode), 'full', `Reset ${mode} to ${sha.substring(0, 7)}`, true);
export const addRemote = (name: string, url: string) => runAction(() => window.gitbox.addRemote(repoPath.value, name, url), 'full', `Add remote ${name}`, true);
export const removeRemote = (name: string) => runAction(() => window.gitbox.removeRemote(repoPath.value, name), 'full', `Remove remote ${name}`, true);
export const renameRemote = (oldName: string, newName: string) => runAction(() => window.gitbox.renameRemote(repoPath.value, oldName, newName), 'full', `Rename remote ${oldName} → ${newName}`, true);
export const setRemoteUrl = (name: string, url: string) => runAction(() => window.gitbox.setRemoteUrl(repoPath.value, name, url), 'full', `Set URL for remote ${name}`, true);
export const stashApply = (stashId?: string) => runAction(() => window.gitbox.stashApply(repoPath.value, stashId), 'full', "Apply stash", true);
export const stashPop = (stashId?: string) => runAction(() => window.gitbox.stashPop(repoPath.value, stashId), 'full', "Pop stash", true);
export const dropStash = (stashId?: string) => runAction(() => window.gitbox.stashDrop(repoPath.value, stashId), 'full', "Drop stash", true);


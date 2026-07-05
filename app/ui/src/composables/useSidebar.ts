import { Ref, ref, computed, triggerRef, watch } from 'vue';
import {
    branches,
    tags,
    submodules,
    selectedLogRef,
    activeTab,
    selectedCommit,
    log,
    loadInitialLog,
    checkoutBranch,
    deleteBranch,
    repoPath
} from '../services/gitService';
import { pullRequests, loadPullRequests, createPullRequest, hasActivePRProvider } from '../services/pullRequestService';
import { buildTree, flattenTree } from '../utils/tree';
import { contextMenu, requestConfirm } from '../services/modalService';
import { getItem, setItem } from '../services/storageService';
import i18n from '../i18n';

const { t } = i18n.global;

// Shared state for sidebar. Groups default to CLOSED; a group is only in here
// (as `true`) once the user opens it. Persisted per repo so reopening a repo
// restores whichever folders were left open.
export const expandedGroups = ref<Record<string, boolean>>({});

const EXPANDED_GROUPS_KEY = 'gitbox_expanded_groups';

function loadExpandedGroups(rp: string): Record<string, boolean> {
    if (!rp) return {};
    try {
        const all = JSON.parse(getItem(EXPANDED_GROUPS_KEY) || '{}');
        return all[rp] || {};
    } catch {
        return {};
    }
}

function persistExpandedGroups(rp: string, groups: Record<string, boolean>) {
    if (!rp) return;
    try {
        const all = JSON.parse(getItem(EXPANDED_GROUPS_KEY) || '{}');
        // Only keep the groups that are open, so the store stays small.
        const open: Record<string, boolean> = {};
        for (const k in groups) if (groups[k]) open[k] = true;
        all[rp] = open;
        setItem(EXPANDED_GROUPS_KEY, JSON.stringify(all));
    } catch {
        /* ignore persistence errors */
    }
}

// Restore the saved expansion state whenever the active repo changes.
watch(repoPath, (rp) => {
    expandedGroups.value = loadExpandedGroups(rp);
}, { immediate: true });
export const sectionsCollapsed = ref<Record<string, boolean>>({
    local: false,
    remotes: true,
    tags: true,
    pull_requests: true,
    submodules: true
});

export function useSidebar(branchFilter: Ref<string>) {
    const headBranchName = computed(() => branches.value.find(b => b.is_head)?.name || '');

    const localBranches = computed(() => branches.value.filter(b => !b.is_remote && b.name.toLowerCase().includes(branchFilter.value.toLowerCase())));
    const remoteBranches = computed(() => branches.value.filter(b => b.is_remote && b.name.toLowerCase().includes(branchFilter.value.toLowerCase())));

    const filteredTags = computed(() => tags.value.filter(t => {
        const name = (typeof t === 'string' ? t : t.name) || '';
        return name.toLowerCase().includes(branchFilter.value.toLowerCase());
    }));

    const filteredSubmodules = computed(() => submodules.value.filter(s => s.path.toLowerCase().includes(branchFilter.value.toLowerCase())));
    const filteredPRs = computed(() => pullRequests.value.filter(pr => (pr.title + (pr.sourceBranch || '')).toLowerCase().includes(branchFilter.value.toLowerCase())));

    const localTree = computed(() => buildTree(localBranches.value, {
        getPath: b => b.name,
        expandedGroups: expandedGroups.value
    }));

    const remoteTree = computed(() => buildTree(remoteBranches.value, {
        getPath: b => b.name,
        expandedGroups: expandedGroups.value
    }));

    const allItems = computed(() => {
        const items: any[] = [];

        // Local Branches
        items.push({ type: 'header', id: 'local', label: t('common.local'), count: localBranches.value.length, collapsed: sectionsCollapsed.value.local });
        if (!sectionsCollapsed.value.local) {
            const flat = flattenTree(localTree.value, expandedGroups.value, headBranchName.value);
            items.push(...flat.map(n => ({ type: 'node', section: 'local', id: `local-${n.name}`, node: n })));
        }

        // Remotes
        items.push({ type: 'header', id: 'remotes', label: t('common.remotes'), count: remoteBranches.value.length, collapsed: sectionsCollapsed.value.remotes });
        if (!sectionsCollapsed.value.remotes) {
            const flat = flattenTree(remoteTree.value, expandedGroups.value, headBranchName.value);
            items.push(...flat.map(n => ({ type: 'node', section: 'remotes', id: `remote-${n.name}`, node: n })));
        }

        // Tags
        items.push({ type: 'header', id: 'tags', label: t('common.tags'), count: filteredTags.value.length, collapsed: sectionsCollapsed.value.tags });
        if (!sectionsCollapsed.value.tags) {
            items.push(...filteredTags.value.map(t => ({ type: 'tag', id: typeof t === 'string' ? t : t.name, data: t })));
        }

        // PRs — only when the repo's remote maps to a supported provider the user
        // is connected to (GitHub / GitLab / Bitbucket). Otherwise the section is
        // hidden entirely instead of showing an empty "Pull Requests (0)".
        if (hasActivePRProvider.value) {
            items.push({ type: 'header', id: 'pull_requests', label: t('common.prs'), count: filteredPRs.value.length, collapsed: sectionsCollapsed.value.pull_requests });
            if (!sectionsCollapsed.value.pull_requests) {
                items.push(...filteredPRs.value.map(pr => ({ type: 'pr', id: pr.id, data: pr })));
            }
        }

        // Submodules
        items.push({ type: 'header', id: 'submodules', label: t('common.submodules'), count: filteredSubmodules.value.length, collapsed: sectionsCollapsed.value.submodules });
        if (!sectionsCollapsed.value.submodules) {
            items.push(...filteredSubmodules.value.map(s => ({ type: 'submodule', id: s.path, data: s })));
        }

        return items;
    });

    async function selectBranchLog(name: string) {
        selectedLogRef.value = name;
        activeTab.value = 'history';

        // Reload the history for this ref immediately — don't wait for the poll.
        await loadInitialLog();

        // Select the branch tip (now near the top of the reloaded log).
        const branch = branches.value.find(b => b.name === name);
        if (branch && branch.target) {
            const commit = log.value.find(c => c.id === branch.target);
            if (commit) {
                selectedCommit.value = commit;
                setTimeout(() => {
                    const el = document.getElementById(`commit-${commit.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }

    function toggleFilter(e: Event, name: string) {
        e.stopPropagation();
        selectedLogRef.value = selectedLogRef.value === name ? '' : name;
        // Reload the log filtered to the new ref right away.
        loadInitialLog();
    }

    function toggleGroup(fullPath: string) {
        // Default (undefined) is closed, so a first click opens it.
        expandedGroups.value[fullPath] = expandedGroups.value[fullPath] !== true;
        triggerRef(expandedGroups);
        persistExpandedGroups(repoPath.value, expandedGroups.value);
    }

    function toggleSection(id: string) {
        sectionsCollapsed.value[id] = !sectionsCollapsed.value[id];
        triggerRef(sectionsCollapsed);
    }

    return {
        allItems,
        sectionsCollapsed,
        expandedGroups,
        selectBranchLog,
        toggleFilter,
        toggleGroup,
        toggleSection,
        checkoutBranch,
        deleteBranch,
        loadPullRequests,
        createPullRequest
    };
}



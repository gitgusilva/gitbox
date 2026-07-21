import { ref, watch, computed } from 'vue';
import { getItem, setItem, removeItem } from './storageService';
import { generalSettings } from './settingsService';
import {
    projects,
    activeProjectId,
    activeProject,
    activeProjectColor,
    ensureProject,
    saveTabsToProject,
    createProject as createProjectEntry,
    removeProject as removeProjectEntry
} from './projectService';

/**
 * Represents a recently opened repository.
 */
export interface RecentRepo {
    /** Display name of the repository. */
    name: string;
    /** Absolute filesystem path. */
    path: string;
    /** Visual color code assigned to this repo. */
    color: string;
    /** Timestamp of when it was last opened. */
    lastOpened: number;
}

/**
 * Represents a workspace tab in the application.
 */
export interface Workspace {
    /** Unique identifier for the tab. */
    id: string;
    /** Display name. */
    name: string;
    /** Absolute filesystem path to the repository. */
    path: string;
    /** Color identifier. */
    color: string;
    /** True if this workspace is a Git submodule of another. */
    isSubmodule?: boolean;
    /** Name of the parent repository if it's a submodule. */
    parentName?: string;
    /** Path of the parent repository if it's a submodule. */
    parentPath?: string;
}

function getLegacyWorkspaces(): Workspace[] {
    const saved = getItem('gitbox_workspaces');
    if (saved && generalSettings.value.rememberTabs) {
        try {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

/**
 * Tabs now belong to a Project. On the first run after this feature the legacy
 * flat keys are adopted as the initial project, so an existing install keeps the
 * tabs it had open instead of starting empty.
 */
function bootstrapProject() {
    const legacyTabs = getLegacyWorkspaces();
    const legacyActive = generalSettings.value.rememberTabs ? getItem('gitbox_active_workspace') : null;
    ensureProject(legacyTabs, legacyActive);
}

bootstrapProject();

/** Tabs of the ACTIVE project — what the toolbar renders. */
export const workspaces = ref<Workspace[]>(
    generalSettings.value.rememberTabs ? (activeProject.value?.tabs ?? []) : []
);

/** ID of the workspace currently visible to the user. */
export const activeWorkspaceId = ref<string | null>(
    generalSettings.value.rememberTabs ? (activeProject.value?.activeTabId ?? null) : null
);

/** History of recently accessed repositories. */
export const recentRepositories = ref<RecentRepo[]>(JSON.parse(getItem('gitbox_recent_repos') || '[]'));

watch(recentRepositories, (val) => {
    setItem('gitbox_recent_repos', JSON.stringify(val));
}, { deep: true });

/** Mirrors the live toolbar state into the project that owns it. */
function persistTabs() {
    if (!generalSettings.value.rememberTabs) {
        removeItem('gitbox_workspaces');
        removeItem('gitbox_active_workspace');
        return;
    }
    if (activeProjectId.value) {
        saveTabsToProject(activeProjectId.value, workspaces.value, activeWorkspaceId.value);
    }
}

watch(workspaces, persistTabs, { deep: true });
watch(activeWorkspaceId, persistTabs);

watch(() => generalSettings.value.rememberTabs, (val) => {
    if (!val) {
        workspaces.value = [];
        activeWorkspaceId.value = null;
        removeItem('gitbox_workspaces');
        removeItem('gitbox_active_workspace');
        removeItem('gitbox_repo_path');
    }
});

/**
 * Adds a new workspace to the application.
 * 
 * @param name - Display name for the tab.
 * @param path - Absolute filesystem path.
 * @param color - Visual color code.
 * @param isSubmodule - Flag for submodule status.
 * @param parentName - Parent repository name (submodules).
 * @param parentPath - Parent repository path (submodules).
 * @returns The newly created workspace object.
 */
export function addWorkspace(name: string, path: string, color: string, isSubmodule: boolean = false, parentName?: string, parentPath?: string) {
    const ws = {
        id: crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36).slice(2),
        name,
        path,
        color,
        isSubmodule,
        parentName,
        parentPath
    };
    workspaces.value.push(ws);
    activeWorkspaceId.value = ws.id;
    return ws;
}

export function updateWorkspace(id: string, updates: Partial<Workspace>) {
    const ws = workspaces.value.find(w => w.id === id);
    if (ws) {
        Object.assign(ws, updates);
    }
}

export function setActiveWorkspace(id: string) {
    activeWorkspaceId.value = id;
}

export function removeWorkspace(id: string) {
    workspaces.value = workspaces.value.filter(w => w.id !== id);

    if (activeWorkspaceId.value === id) {
        activeWorkspaceId.value = workspaces.value.length > 0 ? workspaces.value[0].id : null;
    }
}

/**
 * Makes another project current: the toolbar state is stored back into the
 * outgoing project and the incoming one's tabs take over the tab bar. No-op when
 * the project is already active.
 */
export function switchProject(id: string) {
    if (id === activeProjectId.value) return;
    const target = projects.value.find(p => p.id === id);
    if (!target) return;

    if (activeProjectId.value) {
        saveTabsToProject(activeProjectId.value, workspaces.value, activeWorkspaceId.value);
    }

    activeProjectId.value = id;
    workspaces.value = target.tabs.map(t => ({ ...t }));
    // Nothing open in there yet → land on the welcome screen rather than a stale repo.
    activeWorkspaceId.value = target.tabs.some(t => t.id === target.activeTabId)
        ? target.activeTabId
        : (target.tabs[0]?.id ?? null);
}

/** Creates a project and immediately switches to it (it starts empty). */
export function createAndSwitchProject(name: string, color: string) {
    const p = createProjectEntry(name, color);
    switchProject(p.id);
    return p;
}

/** Deletes a project, switching away first when it is the active one. */
export function deleteProject(id: string) {
    const nextId = removeProjectEntry(id);
    if (nextId) {
        // The removed project was active: adopt the neighbour's tabs.
        activeProjectId.value = null; // force switchProject past its early return
        switchProject(nextId);
    }
}

export function addRecentRepository(name: string, path: string, color: string) {
    if (!path) return;

    const list = recentRepositories.value.filter(r => r.path !== path);
    list.unshift({ name, path, color, lastOpened: Date.now() });

    if (list.length > 20) list.pop();
    recentRepositories.value = list;
}

/**
 * Opens a repository path as a workspace tab.
 * 
 * @param path - Absolute filesystem path.
 * @param name - Optional display name (defaults to folder name).
 * @param isSubmodule - Flag if this is a nested submodule.
 */
export function openRepository(path: string, name: string = '', isSubmodule: boolean = false, parentName?: string, parentPath?: string) {
    if (!name) name = path.split(/[/\\]/).pop() || 'Repo';
    // New repos inherit the active project's colour (still editable per tab), so a
    // project reads as one visual group instead of a wall of identical blue dots.
    const color = activeProjectColor.value;

    addRecentRepository(name, path, color);

    const wsIdToUse = activeWorkspaceId.value;
    const currentWs = workspaces.value.find(w => w.id === wsIdToUse);

    if (currentWs && currentWs.path === '') {
        updateWorkspace(currentWs.id, { name, path, color, isSubmodule, parentName, parentPath });
    } else {
        addWorkspace(name, path, color, isSubmodule, parentName, parentPath);
    }
}

export function addNewTab() {
    return addWorkspace('', '', 'transparent');
}

export async function addWorkspaceFlow() {
    if (!window.gitbox) return null;
    const path = await window.gitbox.selectFolder();
    if (path) {
        openRepository(path);
        return true;
    }
    return false;
}

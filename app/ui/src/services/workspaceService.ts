import { ref, watch, computed } from 'vue';
import { getItem, setItem, removeItem } from './storageService';
import { generalSettings } from './settingsService';

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

function getInitialWorkspaces(): Workspace[] {
    const saved = getItem('gitbox_workspaces');
    if (saved && generalSettings.value.rememberTabs) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return [];
        }
    }
    return [];
}

function getInitialActiveWorkspace(): string | null {
    if (generalSettings.value.rememberTabs) {
        return getItem('gitbox_active_workspace');
    }
    return null;
}

/** List of currently open workspaces (tabs). */
export const workspaces = ref<Workspace[]>(getInitialWorkspaces());

/** ID of the workspace currently visible to the user. */
export const activeWorkspaceId = ref<string | null>(getInitialActiveWorkspace());

/** History of recently accessed repositories. */
export const recentRepositories = ref<RecentRepo[]>(JSON.parse(getItem('gitbox_recent_repos') || '[]'));

watch(recentRepositories, (val) => {
    setItem('gitbox_recent_repos', JSON.stringify(val));
}, { deep: true });

watch(workspaces, (val) => {
    if (generalSettings.value.rememberTabs) {
        // Only persist actual repositories, "New Tab" (empty path) should not be persistent
        const toSave = val.filter(w => w.path && w.path.trim() !== '');
        setItem('gitbox_workspaces', JSON.stringify(toSave));
    } else {
        removeItem('gitbox_workspaces');
    }
}, { deep: true });

watch(activeWorkspaceId, (val) => {
    if (val && generalSettings.value.rememberTabs) setItem('gitbox_active_workspace', val);
    else removeItem('gitbox_active_workspace');
});

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
    const color = '#1E88E5';

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

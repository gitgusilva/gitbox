import { ref, watch, computed } from 'vue';
import { getItem, setItem, removeItem } from './storageService';

export interface RecentRepo {
    name: string;
    path: string;
    color: string;
    lastOpened: number;
}

export interface Workspace {
    id: string;
    name: string;
    path: string;
    color: string;
}

export const workspaces = ref<Workspace[]>(JSON.parse(getItem('gitbox_workspaces') || '[]'));
export const activeWorkspaceId = ref<string | null>(getItem('gitbox_active_workspace'));

export const isChangelogVisible = ref<boolean>(getItem('gitbox_is_changelog_visible') === 'true');

export const recentRepositories = ref<RecentRepo[]>(JSON.parse(getItem('gitbox_recent_repos') || '[]'));

watch(recentRepositories, (val) => {
    setItem('gitbox_recent_repos', JSON.stringify(val));
}, { deep: true });

watch(workspaces, (val) => {
    setItem('gitbox_workspaces', JSON.stringify(val));
}, { deep: true });

watch(activeWorkspaceId, (val) => {
    if (val) setItem('gitbox_active_workspace', val);
    else removeItem('gitbox_active_workspace');
});

watch(isChangelogVisible, (val) => {
    setItem('gitbox_is_changelog_visible', val.toString());
});

export function addWorkspace(name: string, path: string, color: string) {
    const ws = { id: Date.now().toString(), name, path, color };
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

export function openRepository(path: string, name: string = '') {
    if (!name) name = path.split(/[/\\]/).pop() || 'Repo';
    const color = '#1E88E5';

    addRecentRepository(name, path, color);

    const wsIdToUse = activeWorkspaceId.value;
    const currentWs = workspaces.value.find(w => w.id === wsIdToUse);

    if (currentWs && currentWs.path === '') {
        updateWorkspace(currentWs.id, { name, path, color });
    } else {
        addWorkspace(name, path, color);
    }
}

export function addNewTab() {
    return addWorkspace('New Tab', '', 'transparent');
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

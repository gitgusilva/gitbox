import { ref, computed, watch } from 'vue';
import { getItem, setItem } from './storageService';
import type { Workspace } from './workspaceService';

/**
 * A Project is a user-configured GROUP of repositories: it owns the set of repo
 * tabs shown in the toolbar plus which one was last active, and carries a colour
 * used to identify it at a glance (folder button, toolbar strip, and the default
 * colour of repos opened inside it).
 *
 * Switching projects swaps the whole tab bar — see `switchProject` in
 * workspaceService, which is the only place that moves tabs in and out of here.
 * This module deliberately does NOT import workspaceService at runtime (only its
 * type) so the dependency stays one-directional.
 */
export interface Project {
    /** Unique identifier. */
    id: string;
    /** Display name. */
    name: string;
    /** Colour identifier (hex). */
    color: string;
    /** Repo tabs that belong to this project, in toolbar order. */
    tabs: Workspace[];
    /** Tab that was active when the project was last left. */
    activeTabId: string | null;
}

const PROJECTS_KEY = 'gitbox_projects';
const ACTIVE_PROJECT_KEY = 'gitbox_active_project';

/** Palette offered when creating a project (same set the repo tabs use). */
export const PROJECT_COLORS = [
    '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5', '#039BE5', '#00ACC1',
    '#00897B', '#43A047', '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00', '#F4511E'
];

export const DEFAULT_PROJECT_COLOR = '#1E88E5';

function newId(): string {
    return crypto.randomUUID?.() || Date.now().toString() + Math.random().toString(36).slice(2);
}

function loadProjects(): Project[] {
    const saved = getItem(PROJECTS_KEY);
    if (!saved) return [];
    try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** Every project the user has, in menu order. */
export const projects = ref<Project[]>(loadProjects());

/** Id of the project whose tabs are currently on the toolbar. */
export const activeProjectId = ref<string | null>(getItem(ACTIVE_PROJECT_KEY));

export const activeProject = computed<Project | null>(
    () => projects.value.find(p => p.id === activeProjectId.value) || null
);

/** Colour of the active project — the toolbar accent and new-repo default. */
export const activeProjectColor = computed(() => activeProject.value?.color || DEFAULT_PROJECT_COLOR);

watch(projects, (val) => setItem(PROJECTS_KEY, JSON.stringify(val)), { deep: true });
watch(activeProjectId, (val) => { if (val) setItem(ACTIVE_PROJECT_KEY, val); });

/**
 * Guarantees there is at least one project and that one of them is active.
 * `adoptTabs` is used only when creating the very first project, so an existing
 * install keeps the tabs it already had open instead of losing them.
 *
 * The implicit project is created NAMELESS on purpose: services run before the
 * UI locale is settled, so translating here would freeze whatever string (or raw
 * key) happened to be resolvable at that moment into storage forever. The UI
 * renders `project.default_name` for an empty name — see `projectLabel`.
 */
export function ensureProject(adoptTabs: Workspace[] = [], adoptActiveTabId: string | null = null): Project {
    if (projects.value.length === 0) {
        const p: Project = { id: newId(), name: '', color: DEFAULT_PROJECT_COLOR, tabs: adoptTabs, activeTabId: adoptActiveTabId };
        projects.value = [p];
        activeProjectId.value = p.id;
        return p;
    }
    if (!activeProject.value) activeProjectId.value = projects.value[0].id;
    return activeProject.value!;
}

export function createProject(name: string, color: string = DEFAULT_PROJECT_COLOR): Project {
    const p: Project = { id: newId(), name, color, tabs: [], activeTabId: null };
    projects.value = [...projects.value, p];
    return p;
}

export function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>) {
    const p = projects.value.find(x => x.id === id);
    if (p) Object.assign(p, updates);
}

/**
 * Deletes a project. The last remaining one is never removed — without it there
 * would be nowhere to put the tabs the user opens next.
 * @returns the id of the project that should become active, or null if nothing changed.
 */
export function removeProject(id: string): string | null {
    if (projects.value.length <= 1) return null;
    const index = projects.value.findIndex(p => p.id === id);
    if (index === -1) return null;

    projects.value = projects.value.filter(p => p.id !== id);
    if (activeProjectId.value !== id) return null;
    return projects.value[Math.max(0, index - 1)].id;
}

/** Stores the toolbar state into a project (called when leaving it / on change). */
export function saveTabsToProject(id: string, tabs: Workspace[], activeTabId: string | null) {
    const p = projects.value.find(x => x.id === id);
    if (!p) return;
    // Empty "new tab" placeholders are session-only, exactly as before.
    p.tabs = tabs.filter(t => t.path && t.path.trim() !== '').map(t => ({ ...t }));
    p.activeTabId = p.tabs.some(t => t.id === activeTabId) ? activeTabId : (p.tabs[0]?.id ?? null);
}

import { ref, watch } from 'vue';
import { getItem, setItem } from './storageService';

/**
 * Interface for application-wide general settings.
 */
export interface GeneralSettings {
    /** Format string for dates. */
    dateFormat: string;
    /** Number of commits to fetch in the log. */
    historyCount: number;
    /** Show tags directly in the commit graph. */
    showTagsInGraph: boolean;
    /** Check for app updates on startup. */
    checkForUpdates: boolean;
    /** Show or hide labels next to icons in the toolbar. */
    hideIconLabels: boolean;
    /** Colorize common branch prefixes (feat/, fix/). */
    highlightBranchPrefixes: boolean;
    /** Show already closed Pull Requests in the list. */
    showClosedPRs: boolean;
    /** Remember open tabs across sessions. */
    rememberTabs: boolean;
    /** Interval in minutes for background git fetch. */
    autoFetchInterval: number;
    /** Command for the merge tool. */
    externalMergeTool: string;
    /** Command for the diff tool. */
    externalDiffTool: string;
    /** Command to open a file in an external editor. */
    externalEditor: string;
    /** Command to open the terminal in a folder. */
    externalTerminal: string;
    /** Show toast notifications (success/warning/error/info). */
    notificationsEnabled: boolean;
    /** Screen corner where toast notifications appear. */
    notificationPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    /** Merge editor layout: JetBrains-style 3 columns, or the classic stacked panes. */
    mergeLayout: 'columns' | 'stacked';
}

const defaultSettings: GeneralSettings = {
    dateFormat: 'MM/dd/yyyy, HH:mm:ss',
    historyCount: 500,
    showTagsInGraph: true,
    checkForUpdates: true,
    hideIconLabels: false,
    highlightBranchPrefixes: true,
    showClosedPRs: false,
    rememberTabs: true,
    autoFetchInterval: 1,
    externalMergeTool: 'gitbox',
    externalDiffTool: 'use_merge_tool',
    externalEditor: 'none',
    externalTerminal: 'none',
    notificationsEnabled: true,
    notificationPosition: 'bottom-right',
    mergeLayout: 'columns'
};

function loadSettings(): GeneralSettings {
    const saved = getItem('gitbox_general_settings');
    if (saved) {
        try {
            return { ...defaultSettings, ...JSON.parse(saved) };
        } catch (e) {
            return defaultSettings;
        }
    }
    return defaultSettings;
}

/** Global reactive settings state. */
export const generalSettings = ref<GeneralSettings>(loadSettings());

// Guard so applying a broadcast from another window doesn't echo back and loop.
let applyingExternal = false;
const gitbox = (): any => (typeof window !== 'undefined' ? (window as any).gitbox : undefined);

// Persist is debounced: each mutation used to fire a synchronous store IPC +
// broadcast, so dragging a slider (dozens of updates) stuttered. Coalesce into
// one write ~250ms after the last change. `pendingSkipBroadcast` preserves the
// anti-echo guard across the debounce window — a change that originated from
// another window's broadcast persists locally but is not re-broadcast.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSkipBroadcast = false;
watch(generalSettings, () => {
    if (applyingExternal) pendingSkipBroadcast = true;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
        persistTimer = null;
        const skipBroadcast = pendingSkipBroadcast;
        pendingSkipBroadcast = false;
        const val = generalSettings.value;
        setItem('gitbox_general_settings', JSON.stringify(val));
        if (!skipBroadcast) {
            try { gitbox()?.broadcastSettings?.(JSON.parse(JSON.stringify(val))); } catch { /* ignore */ }
        }
    }, 250);
}, { deep: true, flush: 'post' });

// Receive settings changed in another window (e.g. the main Settings) and apply
// them without persisting a broadcast back — keeps open merge windows in sync.
if (gitbox()?.onSettingsChanged) {
    gitbox().onSettingsChanged((incoming: Partial<GeneralSettings>) => {
        if (!incoming) return;
        applyingExternal = true;
        try {
            generalSettings.value = { ...defaultSettings, ...generalSettings.value, ...incoming };
        } finally {
            // Release after the watcher flush so our own write doesn't re-broadcast.
            setTimeout(() => { applyingExternal = false; }, 0);
        }
    });
}

/**
 * Partially updates the general settings and persists them.
 * @param newSettings - Object containing only the fields to update.
 */
export function updateGeneralSettings(newSettings: Partial<GeneralSettings>) {
    generalSettings.value = { ...generalSettings.value, ...newSettings };
}

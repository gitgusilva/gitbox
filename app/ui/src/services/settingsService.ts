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
    notificationPosition: 'bottom-right'
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

watch(generalSettings, (val) => {
    setItem('gitbox_general_settings', JSON.stringify(val));
}, { deep: true, flush: 'post' });

/**
 * Partially updates the general settings and persists them.
 * @param newSettings - Object containing only the fields to update.
 */
export function updateGeneralSettings(newSettings: Partial<GeneralSettings>) {
    generalSettings.value = { ...generalSettings.value, ...newSettings };
}

import { ref, watch } from 'vue';
import { getItem, setItem } from './storageService';

export interface GeneralSettings {
    dateFormat: string;
    historyCount: number;
    showTagsInGraph: boolean;
    checkForUpdates: boolean;
    hideIconLabels: boolean;
    highlightBranchPrefixes: boolean;
}

const defaultSettings: GeneralSettings = {
    dateFormat: 'MM/dd/yyyy, HH:mm:ss',
    historyCount: 2000,
    showTagsInGraph: true,
    checkForUpdates: true,
    hideIconLabels: false,
    highlightBranchPrefixes: true
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

export const generalSettings = ref<GeneralSettings>(loadSettings());

watch(generalSettings, (val) => {
    setItem('gitbox_general_settings', JSON.stringify(val));
}, { deep: true });

export function updateGeneralSettings(newSettings: Partial<GeneralSettings>) {
    generalSettings.value = { ...generalSettings.value, ...newSettings };
}

import { ref } from 'vue';

/** App version — single source of truth, read from the Electron app (package.json). */
export const appVersion = ref('1.0.0');

let loaded = false;

export async function loadAppVersion() {
    if (loaded) return;
    loaded = true;
    try {
        if (window.gitbox?.getAppVersion) {
            const v = await window.gitbox.getAppVersion();
            if (v) appVersion.value = v;
        }
    } catch (err) {
        console.error('Failed to load app version:', err);
    }
}

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

// --- Update check --------------------------------------------------------
const GITHUB_RELEASES_API = 'https://api.github.com/repos/gitgusilva/gitbox/releases/latest';

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'available' | 'error';

export const updateStatus = ref<UpdateStatus>('idle');
export const latestVersion = ref('');
export const releaseUrl = ref('');
export const lastCheckedAt = ref<number | null>(null);

/** Numeric semver-ish comparison: returns >0 if a is newer than b. */
function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(n => parseInt(n, 10) || 0);
    const pb = b.split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d !== 0) return d;
    }
    return 0;
}

/**
 * Check GitHub for the latest release and compare with the running version.
 * Sets `updateStatus` to 'available' (with `latestVersion`/`releaseUrl`),
 * 'up-to-date', or 'error'.
 */
export async function checkForUpdates(): Promise<void> {
    updateStatus.value = 'checking';
    try {
        const res = await fetch(GITHUB_RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const tag = String(data.tag_name || '').replace(/^v/i, '').trim();
        lastCheckedAt.value = Date.now();
        if (!tag) { updateStatus.value = 'error'; return; }
        latestVersion.value = tag;
        releaseUrl.value = data.html_url || '';
        updateStatus.value = compareVersions(tag, appVersion.value) > 0 ? 'available' : 'up-to-date';
    } catch (err) {
        console.error('Update check failed:', err);
        updateStatus.value = 'error';
    }
}

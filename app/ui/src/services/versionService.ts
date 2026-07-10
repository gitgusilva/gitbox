import { ref } from 'vue';
import { showToast } from './toastService';

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

// --- Update state --------------------------------------------------------
const GITHUB_RELEASES_API = 'https://api.github.com/repos/gitgusilva/gitbox/releases/latest';
const RELEASES_PAGE = 'https://github.com/gitgusilva/gitbox/releases/latest';

// 'downloading'/'downloaded' only occur on the natively-updatable targets
// (NSIS on Windows, AppImage on Linux). Everything else uses the legacy check,
// which only ever reaches 'available' and links out to the releases page.
export type UpdateStatus =
    | 'idle' | 'checking' | 'up-to-date' | 'available'
    | 'downloading' | 'downloaded' | 'error';

export const updateStatus = ref<UpdateStatus>('idle');
export const latestVersion = ref('');
export const releaseUrl = ref('');
export const lastCheckedAt = ref<number | null>(null);

/** True once we know the running build can self-update (native updater path). */
export const updaterSupported = ref(false);
/** 0–100 while downloading a native update. */
export const downloadProgress = ref(0);
/** Version that finished downloading and is ready to install. */
export const downloadedVersion = ref('');

interface NativeUpdaterStatus {
    state: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    info?: { version?: string } | null;
    progress?: { percent?: number } | null;
    error?: string | null;
    supported?: boolean;
}

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

let toastedFor = '';

/** Map a native updater status event onto the shared reactive state. */
function applyNativeStatus(s: NativeUpdaterStatus) {
    switch (s.state) {
        case 'checking':
            updateStatus.value = 'checking';
            break;
        case 'available':
            latestVersion.value = s.info?.version || latestVersion.value;
            // autoDownload is on in the main process, so this state is transient
            // (it immediately moves to 'downloading'); surface it as such.
            updateStatus.value = 'downloading';
            break;
        case 'not-available':
            lastCheckedAt.value = Date.now();
            updateStatus.value = 'up-to-date';
            break;
        case 'downloading':
            updateStatus.value = 'downloading';
            downloadProgress.value = Math.round(s.progress?.percent || 0);
            break;
        case 'downloaded':
            downloadProgress.value = 100;
            downloadedVersion.value = s.info?.version || latestVersion.value;
            latestVersion.value = downloadedVersion.value;
            updateStatus.value = 'downloaded';
            // Notify once per downloaded version, even if Settings is never opened.
            if (downloadedVersion.value && toastedFor !== downloadedVersion.value) {
                toastedFor = downloadedVersion.value;
                showToast(
                    'Update ready',
                    `GitBox ${downloadedVersion.value} is ready — restart to install.`,
                    'info',
                    { duration: 0 }
                );
            }
            break;
        case 'error':
            // Fall back to the browser-download path so the user still learns a
            // release exists even when the native updater can't proceed.
            void legacyCheck();
            break;
    }
}

let inited = false;
/** Subscribe to native updater events. Call once at app startup. */
export function initUpdater() {
    if (inited) return;
    inited = true;
    if (window.gitbox?.onUpdaterStatus) {
        window.gitbox.onUpdaterStatus((s: NativeUpdaterStatus) => applyNativeStatus(s));
    }
    // Learn whether this build can self-update (drives the Settings UI wording).
    if (window.gitbox?.updaterGetState) {
        window.gitbox.updaterGetState()
            .then((s: NativeUpdaterStatus) => { updaterSupported.value = !!s?.supported; })
            .catch(() => { updaterSupported.value = false; });
    }
}

/**
 * Check for updates. On a natively-updatable build this kicks off the
 * electron-updater flow (which auto-downloads); otherwise it falls back to the
 * GitHub Releases API and points the user at the releases page.
 */
export async function checkForUpdates(): Promise<void> {
    updateStatus.value = 'checking';
    if (window.gitbox?.updaterCheck) {
        try {
            const res = await window.gitbox.updaterCheck();
            if (res?.supported) { updaterSupported.value = true; return; } // events drive the rest
            updaterSupported.value = false;
        } catch (err) {
            console.error('Native update check failed:', err);
        }
    }
    await legacyCheck();
}

/** Ask the main process to relaunch into the downloaded update. */
export async function installUpdate(): Promise<void> {
    if (window.gitbox?.updaterInstall) {
        try { await window.gitbox.updaterInstall(); }
        catch (err) { console.error('Install update failed:', err); }
    }
}

/** Open the GitHub releases page for a manual download (unsupported builds). */
export function openReleasePage(): void {
    const url = releaseUrl.value || RELEASES_PAGE;
    if (window.gitbox?.openExternal) window.gitbox.openExternal(url);
}

/**
 * Legacy check: compare the latest GitHub release tag with the running version.
 * Used for builds that can't self-update (deb/rpm/pacman/msi, dev).
 */
async function legacyCheck(): Promise<void> {
    try {
        const res = await fetch(GITHUB_RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const tag = String(data.tag_name || '').replace(/^v/i, '').trim();
        lastCheckedAt.value = Date.now();
        if (!tag) { updateStatus.value = 'error'; return; }
        latestVersion.value = tag;
        releaseUrl.value = data.html_url || RELEASES_PAGE;
        updateStatus.value = compareVersions(tag, appVersion.value) > 0 ? 'available' : 'up-to-date';
    } catch (err) {
        console.error('Update check failed:', err);
        updateStatus.value = 'error';
    }
}

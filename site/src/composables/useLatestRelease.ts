import { ref, computed } from 'vue';

/**
 * Reads the newest GitHub release at runtime so the download buttons never go
 * stale after a new tag — the site does not need rebuilding to point at v1.2.0.
 *
 * State is module-level and the request fires once: both the hero badge and the
 * download grid consume the same result instead of racing two calls against the
 * unauthenticated rate limit (60/h per IP). If the API fails or rate-limits, the
 * UI falls back to the /releases/latest page, which always resolves correctly.
 */
const REPO = 'gitgusilva/gitbox';

export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const LATEST_URL = `${RELEASES_URL}/latest`;

export interface ReleaseAsset {
    name: string;
    browser_download_url: string;
    size: number;
}

export type Platform = 'windows' | 'linux' | 'mac' | 'unknown';

export interface DownloadOption {
    label: string;
    hint: string;
    url: string;
    size: string;
}

const version = ref<string | null>(null);
const publishedAt = ref<string | null>(null);
const assets = ref<ReleaseAsset[]>([]);
const failed = ref(false);
const loading = ref(true);

let started: Promise<void> | null = null;

/** Backoff between attempts; a flaky network or a cold DNS usually clears fast. */
const RETRY_DELAYS_MS = [1500, 4000, 10000];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOnce(): Promise<boolean> {
    // Bounded: a hanging request would otherwise leave the download grid stuck
    // on its skeleton forever instead of showing the fallback link.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
        const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json' },
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data = await res.json();
        version.value = data.tag_name;
        publishedAt.value = data.published_at;
        assets.value = (data.assets || []) as ReleaseAsset[];
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

function load(): Promise<void> {
    if (started) return started;
    started = (async () => {
        loading.value = true;
        failed.value = false;
        for (let attempt = 0; ; attempt++) {
            if (await fetchOnce()) {
                failed.value = false;
                loading.value = false;
                return;
            }
            if (attempt >= RETRY_DELAYS_MS.length) break;
            // Surface the fallback link while we keep trying in the background,
            // so a visitor on a flaky connection is never stuck waiting.
            failed.value = true;
            loading.value = false;
            await sleep(RETRY_DELAYS_MS[attempt]);
        }
        failed.value = true;
        loading.value = false;
    })();
    return started;
}

/** Manual "try again" — drops the memoised attempt and starts over. */
export function retryLatestRelease(): Promise<void> {
    started = null;
    return load();
}

function formatSize(bytes: number): string {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** Best guess at the visitor's OS, used to feature one platform over the others. */
export function detectPlatform(): Platform {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux') || ua.includes('x11')) return 'linux';
    return 'unknown';
}

function find(pattern: RegExp): ReleaseAsset | undefined {
    return assets.value.find(a => pattern.test(a.name));
}

function option(asset: ReleaseAsset | undefined, label: string, hint: string): DownloadOption | null {
    if (!asset) return null;
    return { label, hint, url: asset.browser_download_url, size: formatSize(asset.size) };
}

const windows = computed(() => [
    option(find(/\.exe$/), 'Installer (.exe)', 'Recommended for Windows 10/11'),
    option(find(/\.msi$/), 'Package (.msi)', 'For managed / silent installs'),
].filter(Boolean) as DownloadOption[]);

const linux = computed(() => [
    option(find(/\.AppImage$/), 'AppImage', 'Runs anywhere — no install needed'),
    option(find(/\.deb$/), 'Debian (.deb)', 'Debian, Ubuntu, Mint'),
    option(find(/\.rpm$/), 'Fedora (.rpm)', 'Fedora, RHEL, openSUSE'),
    option(find(/\.pacman$/), 'Arch (.pacman)', 'Arch, Manjaro'),
].filter(Boolean) as DownloadOption[]);

export function useLatestRelease() {
    load();
    return { version, publishedAt, assets, windows, linux, failed, loading };
}

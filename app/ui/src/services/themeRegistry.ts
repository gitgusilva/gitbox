import { ref } from 'vue';
import { getItem, setItem } from './storageService';
import { importTheme } from './themeService';
import type { GitboxTheme, ThemeColors } from '../types/theme';

/**
 * Remote theme registry (the gitbox-themes repository).
 *
 * The registry is folder-driven: there is no index file. Each theme lives in
 * `themes/<id>/` with a `theme.json` and a `preview@2x.png`. We discover themes
 * by listing the `themes/` directory through the GitHub contents API, then read
 * each `theme.json` from the raw CDN. Adding a theme upstream is just adding a
 * folder — it shows up here with no other change.
 *
 * Results are cached locally so browsing keeps working offline with the
 * last-known list; built-in and installed themes never depend on the network.
 */

export interface RegistryEntry {
    id: string;
    name: string;
    type: 'light' | 'dark';
    author?: string;
    version?: string;
    description?: string;
    /** Full palette, used for swatches and instant preview. */
    colors: ThemeColors;
    /** Retina preview image (loaded directly by <img>). */
    previewUrl: string;
    /** Raw URL of the theme.json, fetched on install. */
    themeUrl: string;
}

/** Registry source, overridable so a fork / mirror can be pointed at. */
const OWNER = getItem('gitbox_theme_registry_owner') || 'gitgusilva';
const REPO = getItem('gitbox_theme_registry_repo') || 'gitbox-themes';
const BRANCH = getItem('gitbox_theme_registry_branch') || 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const CONTENTS_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/themes?ref=${BRANCH}`;
const CACHE_KEY = 'gitbox_theme_registry_cache';

export const registrySource = { owner: OWNER, repo: REPO, branch: BRANCH };

function loadCache(): RegistryEntry[] {
    try {
        const raw = getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export const registryThemes = ref<RegistryEntry[]>(loadCache());
export const registryLoading = ref(false);
export const registryError = ref<string | null>(null);
export const registryLoaded = ref(false);

// Disk-cached preview images, resolved to base64 data URLs so they render
// offline and never appear broken. Value is `null` when a preview is unavailable.
export const previewCache = ref<Record<string, string | null>>({});
const inflightPreviews = new Set<string>();

/** Resolve a preview URL to a cached data URL (downloads and caches on first use). */
export async function resolvePreview(url?: string): Promise<void> {
    if (!url || url in previewCache.value || inflightPreviews.has(url)) return;
    inflightPreviews.add(url);
    try {
        const dataUrl = await window.gitbox.cachePreview(url);
        previewCache.value = { ...previewCache.value, [url]: dataUrl };
    } catch {
        previewCache.value = { ...previewCache.value, [url]: null };
    } finally {
        inflightPreviews.delete(url);
    }
}

interface ContentsItem {
    name: string;
    type: 'dir' | 'file';
}

/** Read and normalize one theme folder into a registry entry (null if invalid). */
async function loadEntry(id: string): Promise<RegistryEntry | null> {
    const themeUrl = `${RAW_BASE}/themes/${id}/theme.json`;
    try {
        const theme = JSON.parse(await window.gitbox.fetchText(themeUrl));
        if (!theme?.colors || (theme.type !== 'light' && theme.type !== 'dark')) return null;
        return {
            id: typeof theme.id === 'string' && theme.id ? theme.id : id,
            name: theme.name || id,
            type: theme.type,
            author: theme.meta?.author,
            version: theme.meta?.version,
            description: theme.meta?.description,
            colors: theme.colors,
            previewUrl: `${RAW_BASE}/themes/${id}/preview@2x.png`,
            themeUrl,
        };
    } catch {
        return null;
    }
}

/**
 * Refresh the registry from the network: list `themes/`, then read each
 * `theme.json`. Keeps the cached list on failure so offline browsing works.
 */
export async function refreshRegistry(): Promise<void> {
    registryLoading.value = true;
    registryError.value = null;
    try {
        const listing = JSON.parse(await window.gitbox.fetchText(CONTENTS_URL));
        const ids: string[] = Array.isArray(listing)
            ? (listing as ContentsItem[]).filter((e) => e.type === 'dir').map((e) => e.name)
            : [];
        const entries = (await Promise.all(ids.map(loadEntry)))
            .filter((e): e is RegistryEntry => e !== null)
            .sort((a, b) => a.name.localeCompare(b.name));
        registryThemes.value = entries;
        setItem(CACHE_KEY, JSON.stringify(entries));
        registryLoaded.value = true;
    } catch (e: any) {
        // Offline, rate-limited, or unreachable: fall back to whatever is cached.
        registryError.value = e?.message || 'offline';
    } finally {
        registryLoading.value = false;
    }
}

/** Load the registry once per session (uses cache; refreshes in the background). */
export async function ensureRegistry(): Promise<void> {
    if (registryLoaded.value || registryLoading.value) return;
    await refreshRegistry();
}

/** Download a registry theme and import it as an editable custom theme. */
export async function installRegistryTheme(entry: RegistryEntry): Promise<GitboxTheme | null> {
    const text = await window.gitbox.fetchText(entry.themeUrl);
    return importTheme(text);
}

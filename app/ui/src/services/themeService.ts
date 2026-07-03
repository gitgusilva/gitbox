import { ref, computed, watch } from 'vue';
import { getItem, setItem } from './storageService';
import type { GitboxTheme, ThemeColors, ThemeTypography, ThemeMeta } from '../types/theme';
import { COLOR_VARS } from '../types/theme';
import { BUILTIN_THEMES, DEFAULT_DARK_ID, DEFAULT_LIGHT_ID, DEFAULT_TYPOGRAPHY } from './themes/builtins';

// --- Persistent state -------------------------------------------------------

/** The id of the single active theme (any theme in the gallery). */
const activeThemeId = ref<string>(getItem('gitbox_active_theme_id') || DEFAULT_DARK_ID);

/** Identity for de-duplication: same display name + base type = same theme. */
const themeKey = (t: { name: string; type: string }) => `${(t.name || '').trim().toLowerCase()}|${t.type}`;

function loadCustomThemes(): GitboxTheme[] {
    let list: GitboxTheme[] = [];
    try {
        const raw = getItem('gitbox_custom_themes');
        list = raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
    // Drop customs that duplicate a built-in (leftover installs of bundled themes)
    // and any duplicate customs, keeping one card per name+type.
    const builtinKeys = new Set(BUILTIN_THEMES.map(themeKey));
    const seen = new Set<string>();
    const pruned = list.filter((th) => {
        if (!th || !th.name || (th.type !== 'light' && th.type !== 'dark')) return false;
        const k = themeKey(th);
        if (builtinKeys.has(k)) {
            // If the active theme was this redundant copy, point at the built-in.
            if (th.id === activeThemeId.value) {
                const builtin = BUILTIN_THEMES.find((b) => themeKey(b) === k);
                if (builtin) {
                    activeThemeId.value = builtin.id;
                    setItem('gitbox_active_theme_id', builtin.id);
                }
            }
            return false;
        }
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    if (pruned.length !== list.length) setItem('gitbox_custom_themes', JSON.stringify(pruned));
    return pruned;
}
const customThemes = ref<GitboxTheme[]>(loadCustomThemes());
const allThemes = computed<GitboxTheme[]>(() => [...BUILTIN_THEMES, ...customThemes.value]);

function persistCustomThemes() {
    setItem('gitbox_custom_themes', JSON.stringify(customThemes.value));
}

// --- Resolution -------------------------------------------------------------

/** The theme whose tokens are currently applied to the document. */
const activeTheme = computed<GitboxTheme>(() =>
    allThemes.value.find((t) => t.id === activeThemeId.value) || BUILTIN_THEMES[0],
);

/** Back-compat: the active theme's base type ('light' | 'dark'), watched by editors. */
const currentTheme = computed<'light' | 'dark'>(() => activeTheme.value.type);

// --- Monaco bridge (registered by monacoService to avoid a circular import) --

let monacoThemeApplier: ((theme: GitboxTheme) => void) | null = null;
export function registerMonacoThemeApplier(fn: (theme: GitboxTheme) => void) {
    monacoThemeApplier = fn;
    fn(activeTheme.value);
}

// --- Application ------------------------------------------------------------

/** "#RRGGBB" -> "R G B" channels, so Tailwind's `/opacity` modifier works on tokens. */
function hexToChannels(hex: string): string {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
}

function applyGitboxTheme(theme: GitboxTheme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme.type);

    const style = root.style;
    (Object.keys(COLOR_VARS) as (keyof ThemeColors)[]).forEach((key) => {
        style.setProperty(COLOR_VARS[key], hexToChannels(theme.colors[key]));
    });

    const ty = theme.typography;
    style.setProperty('--gb-font-ui', ty.uiFont);
    style.setProperty('--gb-ui-font-size', `${ty.uiFontSize}px`);
    style.setProperty('--gb-font-mono', ty.monoFont);
    style.setProperty('--gb-editor-font', ty.editorFont);
    style.setProperty('--gb-editor-font-size', `${ty.editorFontSize}px`);
    style.setProperty('--gb-editor-line-height', String(ty.editorLineHeight));
    style.setProperty('--gb-radius', `${ty.radius}px`);

    monacoThemeApplier?.(theme);
}

// True only while applying a theme pushed from another window, so the receiving
// window doesn't echo it straight back and cause a broadcast loop.
let applyingExternal = false;

// Reapply whenever the active theme (or any of its nested tokens) changes, and
// relay the change to any other open window (e.g. a standalone merge window).
watch(activeTheme, (t) => {
    applyGitboxTheme(t);
    if (!applyingExternal) {
        try { window.gitbox?.broadcastTheme?.(JSON.parse(JSON.stringify(t))); } catch { /* ignore */ }
    }
}, { deep: true });

// Receive live theme changes from another window (e.g. edits made in the main
// window's Appearance editor) and apply them without persisting or re-broadcasting.
if (typeof window !== 'undefined' && window.gitbox?.onThemeChanged) {
    window.gitbox.onThemeChanged((incoming) => {
        const theme = incoming as GitboxTheme | null;
        if (!theme || !theme.colors) return;
        applyingExternal = true;
        try { applyGitboxTheme(theme); }
        finally { applyingExternal = false; }
    });
}

// --- Public API -------------------------------------------------------------

export { currentTheme, customThemes, allThemes, activeTheme, activeThemeId };

/** Back-compat entry point (App.vue, editors). Applying just re-asserts the active theme. */
export function useTheme() {
    function applyTheme(_mode?: unknown) {
        applyGitboxTheme(activeTheme.value);
    }
    return { currentTheme, applyTheme };
}

/** Make a theme the single active theme. */
export function selectTheme(theme: GitboxTheme) {
    activeThemeId.value = theme.id;
    setItem('gitbox_active_theme_id', theme.id);
}

function newId() {
    // UUID keeps theme identity globally unique across machines / a future repo.
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function defaultMeta(): ThemeMeta {
    return { version: '1.0.0' };
}

function cloneTheme(source: GitboxTheme, name: string): GitboxTheme {
    return {
        id: newId(),
        name,
        type: source.type,
        builtin: false,
        meta: { ...(source.meta || defaultMeta()) },
        colors: { ...source.colors },
        typography: { ...source.typography },
    };
}

/** Duplicate any theme into an editable custom theme and select it. */
export function duplicateTheme(source: GitboxTheme, name?: string): GitboxTheme {
    const copy = cloneTheme(source, name || `${source.name} (Copy)`);
    customThemes.value.push(copy);
    persistCustomThemes();
    selectTheme(copy);
    return copy;
}

/**
 * Returns the live, editable theme currently active. Editing a built-in forks
 * it into a custom copy first (built-ins are read-only).
 */
function ensureEditableActive(): GitboxTheme {
    const active = activeTheme.value;
    if (!active.builtin) {
        return customThemes.value.find((t) => t.id === active.id) || active;
    }
    const copy = cloneTheme(active, `${active.name} (Custom)`);
    customThemes.value.push(copy);
    persistCustomThemes();
    selectTheme(copy);
    return customThemes.value.find((t) => t.id === copy.id)!;
}

export function updateActiveColor(key: keyof ThemeColors, value: string) {
    const theme = ensureEditableActive();
    theme.colors[key] = value;
    persistCustomThemes();
    applyGitboxTheme(activeTheme.value);
}

export function updateActiveTypography<K extends keyof ThemeTypography>(key: K, value: ThemeTypography[K]) {
    const theme = ensureEditableActive();
    theme.typography[key] = value;
    persistCustomThemes();
    applyGitboxTheme(activeTheme.value);
}

export function renameActiveTheme(name: string) {
    const active = activeTheme.value;
    if (active.builtin) return;
    const theme = customThemes.value.find((t) => t.id === active.id);
    if (theme) { theme.name = name; persistCustomThemes(); }
}

export function updateActiveMeta<K extends keyof ThemeMeta>(key: K, value: ThemeMeta[K]) {
    const theme = ensureEditableActive();
    theme.meta = { ...(theme.meta || { version: '1.0.0' }), [key]: value };
    persistCustomThemes();
}

/** Delete a custom theme; if it was active, fall back to the matching default. */
export function deleteTheme(id: string) {
    const theme = customThemes.value.find((t) => t.id === id);
    if (!theme) return;
    customThemes.value = customThemes.value.filter((t) => t.id !== id);
    persistCustomThemes();
    if (activeThemeId.value === id) {
        const fallbackId = theme.type === 'light' ? DEFAULT_LIGHT_ID : DEFAULT_DARK_ID;
        selectTheme(allThemes.value.find((t) => t.id === fallbackId) || BUILTIN_THEMES[0]);
    }
}

/** Reset the active theme to the matching built-in's colors and typography. */
export function resetActiveTheme() {
    const theme = ensureEditableActive();
    const builtin = BUILTIN_THEMES.find((t) => t.type === theme.type)!;
    theme.colors = { ...builtin.colors };
    theme.typography = { ...DEFAULT_TYPOGRAPHY };
    persistCustomThemes();
    applyGitboxTheme(activeTheme.value);
}

/** Serialize a theme for sharing — keeps its stable id + metadata, drops the runtime `builtin` flag. */
export function exportTheme(theme: GitboxTheme): string {
    const { builtin, ...rest } = theme;
    const payload: Omit<GitboxTheme, 'builtin'> = {
        ...rest,
        meta: { version: '1.0.0', ...(theme.meta || {}) },
    };
    return JSON.stringify(payload, null, 2);
}

/**
 * Import a theme from JSON. The stable id is preserved (re-importing the same
 * theme updates it); a built-in id or missing id is reassigned so nothing is
 * clobbered. Returns the theme, or null when the payload is invalid.
 */
export function importTheme(json: string): GitboxTheme | null {
    try {
        const parsed = JSON.parse(json);
        if (!parsed?.colors || !parsed?.type) return null;
        const type: 'light' | 'dark' = parsed.type === 'light' ? 'light' : 'dark';
        const base = BUILTIN_THEMES.find((t) => t.type === type)!;

        let id: string = typeof parsed.id === 'string' && parsed.id ? parsed.id : newId();
        if (BUILTIN_THEMES.some((t) => t.id === id)) id = newId();

        const theme: GitboxTheme = {
            id,
            name: parsed.name || 'Imported Theme',
            type,
            builtin: false,
            meta: { version: '1.0.0', ...(parsed.meta || {}) },
            colors: { ...base.colors, ...parsed.colors },
            typography: { ...DEFAULT_TYPOGRAPHY, ...(parsed.typography || {}) },
        };

        const idx = customThemes.value.findIndex((t) => t.id === id);
        if (idx >= 0) customThemes.value.splice(idx, 1, theme);
        else customThemes.value.push(theme);
        persistCustomThemes();
        selectTheme(theme);
        return theme;
    } catch {
        return null;
    }
}

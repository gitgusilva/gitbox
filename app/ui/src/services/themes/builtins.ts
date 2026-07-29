import type { GitboxTheme, ThemeTypography } from '../../types/theme';

/** Shared typography defaults; individual themes may override any field. */
export const DEFAULT_TYPOGRAPHY: ThemeTypography = {
    uiFont: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
    uiFontSize: 13,
    monoFont: "'IBM Plex Mono', 'SF Mono', Consolas, monospace",
    editorFont: "'IBM Plex Mono', 'SF Mono', Consolas, 'Courier New', monospace",
    editorFontSize: 13,
    editorLineHeight: 0,
    radius: 6,
};

/** Default dark theme — matches the palette the app shipped with. */
export const GITBOX_DARK: GitboxTheme = {
    id: 'gitbox-dark',
    name: 'GitBox Dark',
    type: 'dark',
    builtin: true,
    meta: { version: '1.0.0', author: 'GitBox', description: 'Default dark theme.' },
    colors: {
        bg: '#1E1E1E',
        bgElevated: '#252526',
        bgOverlay: '#2D2D2D',
        surfaceHover: '#2A2A2B',
        border: '#2D2D2D',
        borderStrong: '#3A3A3A',
        textStrong: '#F2F2F2',
        text: '#CCCCCC',
        textMuted: '#8A8A8A',
        accent: '#2563EB',
        accentHover: '#3B82F6',
        accentFg: '#FFFFFF',
        added: '#22C55E',
        removed: '#EF4444',
        modified: '#57B0FF',
        // The palette the app shipped with — kept as-is so the default theme is
        // unchanged. Every theme carries its own from here on: leaving them out
        // silently falls back to DEFAULT_GRAPH_COLORS, which is why the graph
        // used to look identical under every theme.
        graph1: '#1E88E5', graph2: '#FFAB00', graph3: '#00E676', graph4: '#D500F9',
        graph5: '#FF3D00', graph6: '#00B0FF', graph7: '#1DE9B6', graph8: '#F50057',
        graphMarker: '#1E1E1E',
    },
    typography: { ...DEFAULT_TYPOGRAPHY },
};

/**
 * Everything the app ships with. Dark only — the catalogue lives in the
 * `gitbox-themes` registry, where a theme is a folder with its own author and
 * preview and needs no release to land. This is the offline floor: the one
 * theme that is guaranteed to resolve with no network and no storage.
 */
export const BUILTIN_THEMES: GitboxTheme[] = [GITBOX_DARK];

export const DEFAULT_DARK_ID = GITBOX_DARK.id;

/**
 * GitBox theming model. A theme is a flat set of semantic color tokens plus
 * typography, applied app-wide as CSS variables (and mirrored into Monaco).
 */

export interface ThemeColors {
    /** Base app background. */
    bg: string;
    /** Panels, headers, sidebars. */
    bgElevated: string;
    /** Menus, popovers, modals. */
    bgOverlay: string;
    /** Hover background for interactive surfaces. */
    surfaceHover: string;
    /** Default borders / dividers. */
    border: string;
    /** Emphasized borders. */
    borderStrong: string;
    /** Emphasized text (headings). */
    textStrong: string;
    /** Primary text. */
    text: string;
    /** Secondary / muted text. */
    textMuted: string;
    /** Accent (primary action / selection). */
    accent: string;
    /** Accent hover. */
    accentHover: string;
    /** Foreground on top of the accent color. */
    accentFg: string;
    /** Git added / incoming. */
    added: string;
    /** Git removed. */
    removed: string;
    /** Git modified / current. */
    modified: string;
    // Commit-graph lane colors (cycled across branches) + the merge/dot glyph.
    // Optional so existing themes fall back to DEFAULT_GRAPH_COLORS.
    graph1?: string;
    graph2?: string;
    graph3?: string;
    graph4?: string;
    graph5?: string;
    graph6?: string;
    graph7?: string;
    graph8?: string;
    /** Color of the '+' drawn on merge dots (defaults to white). */
    graphMarker?: string;
}

export interface ThemeTypography {
    /** UI font family stack. */
    uiFont: string;
    /** Root UI font size in px (drives rem-based sizing). */
    uiFontSize: number;
    /** Monospace font stack (non-editor code). */
    monoFont: string;
    /** Monaco editor font family. */
    editorFont: string;
    /** Monaco editor font size in px. */
    editorFontSize: number;
    /** Monaco editor line height in px (0 = automatic). */
    editorLineHeight: number;
    /** Global corner radius in px. */
    radius: number;
}

/** Portable metadata carried in the theme's JSON (for sharing / a future repo). */
export interface ThemeMeta {
    /** Semantic version of the theme, e.g. "1.0.0". */
    version: string;
    author?: string;
    /** Author contact email. */
    authorEmail?: string;
    description?: string;
}

export interface GitboxTheme {
    /** Globally-unique, stable id (UUID) so themes from different sources never collide. */
    id: string;
    name: string;
    type: 'light' | 'dark';
    /** True for shipped themes (read-only; editing forks a copy). */
    builtin?: boolean;
    meta?: ThemeMeta;
    colors: ThemeColors;
    typography: ThemeTypography;
}

/** Maps each color token to its CSS custom property. */
export const COLOR_VARS: Record<keyof ThemeColors, string> = {
    bg: '--gb-bg',
    bgElevated: '--gb-bg-elevated',
    bgOverlay: '--gb-bg-overlay',
    surfaceHover: '--gb-surface-hover',
    border: '--gb-border',
    borderStrong: '--gb-border-strong',
    textStrong: '--gb-text-strong',
    text: '--gb-text',
    textMuted: '--gb-text-muted',
    accent: '--gb-accent',
    accentHover: '--gb-accent-hover',
    accentFg: '--gb-accent-fg',
    added: '--gb-added',
    removed: '--gb-removed',
    modified: '--gb-modified',
    graph1: '--gb-graph-1',
    graph2: '--gb-graph-2',
    graph3: '--gb-graph-3',
    graph4: '--gb-graph-4',
    graph5: '--gb-graph-5',
    graph6: '--gb-graph-6',
    graph7: '--gb-graph-7',
    graph8: '--gb-graph-8',
    graphMarker: '--gb-graph-marker',
};

/** Fallback commit-graph palette + marker used when a theme omits them. */
export const DEFAULT_GRAPH_COLORS: Record<string, string> = {
    graph1: '#1E88E5', graph2: '#FFAB00', graph3: '#00E676', graph4: '#D500F9',
    graph5: '#FF3D00', graph6: '#00B0FF', graph7: '#1DE9B6', graph8: '#F50057',
    graphMarker: '#FFFFFF',
};

/** Human-friendly grouping/labels for the color editor UI. */
export const COLOR_GROUPS: { label: string; keys: (keyof ThemeColors)[] }[] = [
    { label: 'Backgrounds', keys: ['bg', 'bgElevated', 'bgOverlay', 'surfaceHover'] },
    { label: 'Borders', keys: ['border', 'borderStrong'] },
    { label: 'Text', keys: ['textStrong', 'text', 'textMuted'] },
    { label: 'Accent', keys: ['accent', 'accentHover', 'accentFg'] },
    { label: 'Git', keys: ['added', 'removed', 'modified'] },
    { label: 'Commit Graph', keys: ['graph1', 'graph2', 'graph3', 'graph4', 'graph5', 'graph6', 'graph7', 'graph8', 'graphMarker'] },
];

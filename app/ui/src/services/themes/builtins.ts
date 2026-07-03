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
    },
    typography: { ...DEFAULT_TYPOGRAPHY },
};

/** Default light theme. */
export const GITBOX_LIGHT: GitboxTheme = {
    id: 'gitbox-light',
    name: 'GitBox Light',
    type: 'light',
    builtin: true,
    meta: { version: '1.0.0', author: 'GitBox', description: 'Default light theme.' },
    colors: {
        bg: '#FFFFFF',
        bgElevated: '#F6F8FA',
        bgOverlay: '#FFFFFF',
        surfaceHover: '#EEF1F4',
        border: '#D0D7DE',
        borderStrong: '#AFB8C1',
        textStrong: '#1F2328',
        text: '#24292F',
        textMuted: '#656D76',
        accent: '#0969DA',
        accentHover: '#2178E0',
        accentFg: '#FFFFFF',
        added: '#1A7F37',
        removed: '#CF222E',
        modified: '#0969DA',
    },
    typography: { ...DEFAULT_TYPOGRAPHY },
};

/**
 * Bundled community-style presets (inspired by popular market themes). They ship
 * read-only like the defaults — editing one forks an editable copy — but appear
 * in the theme gallery with their author metadata, as if published.
 */
export const BUNDLED_THEMES: GitboxTheme[] = [
    {
        id: 'preset-dracula', name: 'Dracula', type: 'dark', builtin: true,
        meta: { version: '1.0.0', author: 'GitBox', description: 'A dark theme for the creatures of the night.' },
        colors: {
            bg: '#282A36', bgElevated: '#21222C', bgOverlay: '#343746', surfaceHover: '#3A3C4E',
            border: '#191A21', borderStrong: '#44475A', textStrong: '#F8F8F2', text: '#F8F8F2', textMuted: '#6272A4',
            accent: '#BD93F9', accentHover: '#CBA6FA', accentFg: '#282A36', added: '#50FA7B', removed: '#FF5555', modified: '#8BE9FD',
        },
        typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
        id: 'preset-one-dark', name: 'One Dark Pro', type: 'dark', builtin: true,
        meta: { version: '1.0.0', author: 'GitBox', description: 'Atom\'s iconic One Dark, refined.' },
        colors: {
            bg: '#282C34', bgElevated: '#21252B', bgOverlay: '#2C313A', surfaceHover: '#333842',
            border: '#181A1F', borderStrong: '#3B4048', textStrong: '#FFFFFF', text: '#ABB2BF', textMuted: '#5C6370',
            accent: '#61AFEF', accentHover: '#7CC0F5', accentFg: '#282C34', added: '#98C379', removed: '#E06C75', modified: '#61AFEF',
        },
        typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
        id: 'preset-nord', name: 'Nord', type: 'dark', builtin: true,
        meta: { version: '1.0.0', author: 'GitBox', description: 'An arctic, north-bluish color palette.' },
        colors: {
            bg: '#2E3440', bgElevated: '#3B4252', bgOverlay: '#434C5E', surfaceHover: '#4C566A',
            border: '#3B4252', borderStrong: '#4C566A', textStrong: '#ECEFF4', text: '#D8DEE9', textMuted: '#7B88A1',
            accent: '#88C0D0', accentHover: '#8FBCBB', accentFg: '#2E3440', added: '#A3BE8C', removed: '#BF616A', modified: '#81A1C1',
        },
        typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
        id: 'preset-monokai', name: 'Monokai', type: 'dark', builtin: true,
        meta: { version: '1.0.0', author: 'GitBox', description: 'The classic Monokai palette.' },
        colors: {
            bg: '#272822', bgElevated: '#1E1F1C', bgOverlay: '#34352F', surfaceHover: '#3E3D32',
            border: '#1E1F1C', borderStrong: '#49483E', textStrong: '#FFFFFF', text: '#F8F8F2', textMuted: '#75715E',
            accent: '#66D9EF', accentHover: '#8AE4F2', accentFg: '#272822', added: '#A6E22E', removed: '#F92672', modified: '#66D9EF',
        },
        typography: { ...DEFAULT_TYPOGRAPHY },
    },
    {
        id: 'preset-solarized-light', name: 'Solarized Light', type: 'light', builtin: true,
        meta: { version: '1.0.0', author: 'GitBox', description: 'Precision colors for machines and people.' },
        colors: {
            bg: '#FDF6E3', bgElevated: '#EEE8D5', bgOverlay: '#FDF6E3', surfaceHover: '#E7E0CC',
            border: '#EEE8D5', borderStrong: '#D8D0B8', textStrong: '#073642', text: '#657B83', textMuted: '#93A1A1',
            accent: '#268BD2', accentHover: '#3A9BE0', accentFg: '#FDF6E3', added: '#859900', removed: '#DC322F', modified: '#268BD2',
        },
        typography: { ...DEFAULT_TYPOGRAPHY },
    },
];

export const BUILTIN_THEMES: GitboxTheme[] = [GITBOX_DARK, GITBOX_LIGHT, ...BUNDLED_THEMES];

export const DEFAULT_DARK_ID = GITBOX_DARK.id;
export const DEFAULT_LIGHT_ID = GITBOX_LIGHT.id;
/** The two ids that live on the mode switch (kept out of the gallery). */
export const DEFAULT_THEME_IDS = [DEFAULT_DARK_ID, DEFAULT_LIGHT_ID];

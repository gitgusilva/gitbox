import { watch } from 'vue';
import loader from '@monaco-editor/loader';
import type { GitboxTheme, ThemeTypography } from '../types/theme';
import { activeTheme, registerMonacoThemeApplier } from './themeService';

export function getLanguage(path: string = '') {
    const parts = path.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
    const map: Record<string, string> = {
        'js': 'javascript', 'ts': 'typescript', 'vue': 'html', 'html': 'html',
        'css': 'css', 'json': 'json', 'md': 'markdown', 'py': 'python',
        'rs': 'rust', 'go': 'go', 'cpp': 'cpp', 'cc': 'cpp', 'h': 'cpp',
        'php': 'php', 'rb': 'ruby', 'java': 'java', 'cs': 'csharp',
        'sh': 'shell', 'yaml': 'yaml', 'yml': 'yaml', 'xml': 'xml',
        'sql': 'sql', 'dockerfile': 'dockerfile'
    };
    return (ext && map[ext]) || 'plaintext';
}

let monacoNs: any = null;
let themeDefined = false;
const ACTIVE_THEME_NAME = 'gitbox-active';

function prefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Once the GitBox theme is defined in Monaco, always return it so editors and
 * their theme-change watchers stay on the tokenized theme.
 */
export function getMonacoTheme(mode: string) {
    if (themeDefined) return ACTIVE_THEME_NAME;
    return mode === 'light' || (mode === 'system' && !prefersDark()) ? 'vs' : 'vs-dark';
}

/** Append an alpha channel (0..1) to a #RRGGBB color. */
function withAlpha(hex: string, alpha: number) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

function defineMonacoTheme(theme: GitboxTheme) {
    if (!monacoNs) return;
    const c = theme.colors;
    monacoNs.editor.defineTheme(ACTIVE_THEME_NAME, {
        base: theme.type === 'light' ? 'vs' : 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': c.bg,
            'editor.foreground': c.text,
            'editorLineNumber.foreground': withAlpha(c.textMuted, 0.6),
            'editorLineNumber.activeForeground': c.text,
            'editorCursor.foreground': c.text,
            'editor.selectionBackground': withAlpha(c.accent, 0.30),
            'editor.inactiveSelectionBackground': withAlpha(c.accent, 0.18),
            'editor.lineHighlightBackground': withAlpha(c.surfaceHover, 0.5),
            'editorIndentGuide.background': withAlpha(c.border, 0.7),
            'editorWhitespace.foreground': withAlpha(c.textMuted, 0.3),
            'editorGutter.background': c.bg,
            'diffEditor.insertedTextBackground': withAlpha(c.added, 0.18),
            'diffEditor.removedTextBackground': withAlpha(c.removed, 0.18),
            'diffEditor.insertedLineBackground': withAlpha(c.added, 0.10),
            'diffEditor.removedLineBackground': withAlpha(c.removed, 0.10),
            'scrollbarSlider.background': withAlpha(c.textMuted, 0.25),
            'scrollbarSlider.hoverBackground': withAlpha(c.textMuted, 0.4),
        },
    });
    themeDefined = true;
    monacoNs.editor.setTheme(ACTIVE_THEME_NAME);
}

function applyEditorTypography(ty: ThemeTypography) {
    monacoOptions.fontFamily = ty.editorFont;
    monacoOptions.fontSize = ty.editorFontSize;
    monacoOptions.lineHeight = ty.editorLineHeight || 0; // 0 = auto (Monaco derives from fontSize)
    monacoNs?.editor?.getEditors?.().forEach((e: any) => e.updateOptions({
        fontFamily: ty.editorFont,
        fontSize: ty.editorFontSize,
        lineHeight: ty.editorLineHeight || 0,
    }));
}

export const monacoOptions: any = {
    automaticLayout: false,
    minimap: { enabled: false },
    stickyScroll: { enabled: false },
    contextmenu: false,
    // Keep editors read-only but suppress Monaco's "Cannot edit in read-only
    // editor" tooltip when the user types into a read-only pane.
    readOnlyMessage: { value: '' },
    scrollBeyondLastLine: false,
    renderOverviewRuler: false,
    fontFamily: activeTheme.value.typography.editorFont,
    fontSize: activeTheme.value.typography.editorFontSize,
    lineHeight: activeTheme.value.typography.editorLineHeight || 0,
    scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
    },
    lightbulb: { enabled: false },
    hideUnchangedRegions: { enabled: false },
    renderMarginRevertIcon: false,
    renderIndicators: false,
    diffCodeLens: false,
    useInlineViewWhenSpaceIsLimited: false,
};

// Wire theme changes into Monaco. Registered after monacoOptions is initialized
// so the initial apply (invoked synchronously here) can read it safely.
registerMonacoThemeApplier((theme) => {
    defineMonacoTheme(theme);
    applyEditorTypography(theme.typography);
});

export function useMonacoTheme(currentTheme: any, monacoRef: any) {
    watch(currentTheme, (val) => {
        if (monacoRef.value) {
            monacoRef.value.editor.setTheme(getMonacoTheme(val));
        }
    });
}

export async function initMonaco() {
    monacoNs = await loader.init();
    // Define the tokenized theme now that Monaco is available.
    defineMonacoTheme(activeTheme.value);
    applyEditorTypography(activeTheme.value.typography);
    return monacoNs;
}

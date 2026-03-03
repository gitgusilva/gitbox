import { watch } from 'vue';
import loader from '@monaco-editor/loader';

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

export function getMonacoTheme(theme: string) {
    return theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'vs' : 'vs-dark';
}

export const monacoOptions = {
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    renderOverviewRuler: false,
    scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
    }
};

export function useMonacoTheme(currentTheme: any, monacoRef: any) {
    watch(currentTheme, (val) => {
        if (monacoRef.value) {
            monacoRef.value.editor.setTheme(getMonacoTheme(val));
        }
    });
}

export async function initMonaco() {
    return await loader.init();
}

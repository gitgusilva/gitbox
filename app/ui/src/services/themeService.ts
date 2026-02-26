import { ref, watch } from 'vue';
import { Theme } from '../types/app';
import { getItem, setItem } from './storageService';

const currentTheme = ref<Theme>((getItem('gitbox_theme') as Theme) || 'system');

export function useTheme() {
    function applyTheme(theme: Theme) {
        const root = window.document.documentElement;

        let effectiveTheme = theme;
        if (theme === 'system') {
            effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        root.classList.remove('light', 'dark');
        root.classList.add(effectiveTheme);

        setItem('gitbox_theme', theme);
        currentTheme.value = theme;
    }

    // Watch for system preference changes if theme is 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme.value === 'system') {
            applyTheme('system');
        }
    });

    return {
        currentTheme,
        applyTheme
    };
}

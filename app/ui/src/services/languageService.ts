import { ref } from 'vue';
import i18n from '../i18n';
import { setItem } from './storageService';

export interface Language {
    code: string;
    name: string;
}

export const languages: Language[] = [
    { code: 'en', name: 'English' },
    { code: 'pt-br', name: 'Português (Brasil)' },
    { code: 'es', name: 'Español' }
];

export function useLanguage() {
    function changeLanguage(langCode: string) {
        const lang = languages.find(l => l.code === langCode);
        if (lang) {
            (i18n.global.locale as any).value = langCode;
            setItem('gitbox_locale', langCode);
        }
    }

    function getLanguagePromptName(langCode: string): string {
        const lang = languages.find(l => l.code === langCode);
        return lang ? lang.name : 'English';
    }

    return {
        languages,
        changeLanguage,
        getLanguagePromptName
    };
}

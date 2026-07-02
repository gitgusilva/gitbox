import { createI18n } from 'vue-i18n';
import en from './en.json';
import ptBr from './pt-br.json';
import es from './es.json';
import { getItem } from '../services/storageService';

const i18n = createI18n({
    legacy: false,
    locale: getItem('gitbox_locale') || 'en',
    fallbackLocale: 'en',
    messages: {
        en,
        'pt-br': ptBr,
        'pt': ptBr,
        es
    }
});

export default i18n;

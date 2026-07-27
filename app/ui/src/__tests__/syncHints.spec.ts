import { describe, it, expect } from 'vitest';
import en from '../i18n/en.json';
import ptBr from '../i18n/pt-br.json';
import es from '../i18n/es.json';

/**
 * The sidebar's ↑/↓ counters say how many commits, but not what they count — a
 * single tooltip names pull and push.
 *
 * These are vue-i18n plural messages ("one form | other form"). Selecting the
 * right form is the library's job (and already exercised by project.repo_count);
 * what regresses here is the DATA — a locale losing a form renders the raw
 * "a | b" to the user, and a copy-pasted key ships English to everyone.
 */
describe('pull/push tooltip messages', () => {
    const LOCALES = { en, 'pt-br': ptBr, es } as Record<string, any>;
    const KEYS = ['to_pull', 'to_push'];

    const forms = (locale: string, key: string): string[] =>
        String(LOCALES[locale].sync[key]).split('|').map(s => s.trim());

    it.each(Object.keys(LOCALES))('%s defines both plural forms for each hint', (locale) => {
        for (const key of KEYS) {
            const parts = forms(locale, key);
            expect(parts).toHaveLength(2);
            parts.forEach(p => expect(p.length).toBeGreaterThan(0));
            expect(parts[0]).not.toBe(parts[1]);
            // The singular is spelled out; the plural has to interpolate.
            expect(parts[0].startsWith('1 commit')).toBe(true);
            expect(parts[1]).toContain('{count}');
        }
    });

    it.each(Object.keys(LOCALES))('%s words pull and push differently', (locale) => {
        expect(forms(locale, 'to_pull')).not.toEqual(forms(locale, 'to_push'));
    });

    it.each(KEYS)('%s is not left in English in the other locales', (key) => {
        // Only compared against English: pt-br and es legitimately coincide here
        // ("1 commit para enviar" is the same sentence in both).
        const english = forms('en', key)[1];
        ['pt-br', 'es'].forEach(locale => expect(forms(locale, key)[1]).not.toBe(english));
    });
});

import { ref } from 'vue';
import { getItem } from '../storageService';
import { useLanguage } from '../languageService';
import { AIResponse } from './core/types';
import { BaseAIProvider } from './core/BaseProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { CliProvider } from './providers/CliProvider';

const providers: Record<string, BaseAIProvider> = {
    gemini: new GeminiProvider()
};

// Reactive tick bumped whenever the AI config (provider / key) changes, so
// UI that gates on isAIConfigured() re-evaluates immediately instead of staying
// cached from first render.
export const aiConfigVersion = ref(0);
export function notifyAiConfigChanged() {
    aiConfigVersion.value++;
}

const { getLanguagePromptName } = useLanguage();

/**
 * Resolves the active provider plus how it authenticates. Providers stored as
 * `cli:<id>` are local CLIs (Claude, Gemini CLI, …) that use their own login and
 * need no API key; everything else is an API provider keyed by an API key.
 */
function activeProviderAndKey(): { provider: BaseAIProvider | null; apiKey: string; needsKey: boolean } {
    const providerId = getItem('gitbox_ai_provider') || 'gemini';
    if (providerId.startsWith('cli:')) {
        return { provider: new CliProvider(providerId.slice(4)), apiKey: '', needsKey: false };
    }
    return { provider: providers[providerId] || null, apiKey: getItem('gitbox_ai_api_key') || '', needsKey: true };
}

/**
 * Generates a Git commit message from a given diff and locale.
 * 
 * @param diff - The git diff string.
 * @param locale - The user's current language code (e.g. 'en', 'pt-br').
 * @returns A promise that resolves to an AIResponse.
 * 
 * @example
 * ```typescript
 * const response = await generateCommitMessage(currentDiff, 'pt-br');
 * if (!response.error) {
 *   commitMessage.value = response.text;
 * }
 * ```
 */
export async function generateCommitMessage(diff: string, locale: string = 'en'): Promise<AIResponse> {
    const { provider, apiKey, needsKey } = activeProviderAndKey();
    if (!provider) return { text: '', error: 'AI Provider not found' };
    if (needsKey && !apiKey) return { text: '', error: 'API Key not configured' };

    const language = getLanguagePromptName(locale);
    return provider.generateCommitMessage(diff, language, apiKey);
}

/**
 * Explains the changes in a git diff in natural language.
 * 
 * @param diff - The git diff string.
 * @param locale - The user's current language code.
 * @returns A promise that resolves to an AIResponse.
 */
export async function explainChanges(diff: string, locale: string = 'en'): Promise<AIResponse> {
    const { provider, apiKey, needsKey } = activeProviderAndKey();
    if (!provider) return { text: '', error: 'AI Provider not found' };
    if (needsKey && !apiKey) return { text: '', error: 'API Key not configured' };

    const language = getLanguagePromptName(locale);
    return provider.explainChanges(diff, language, apiKey);
}

/**
 * Checks if the AI system has a provider and API key configured.
 * @returns True if configured.
 */
export function isAIConfigured(): boolean {
    const { provider, apiKey, needsKey } = activeProviderAndKey();
    return !!provider && (!needsKey || !!apiKey);
}

/**
 * Generates a Pull Request summary (Title and Description) from contextual data.
 * 
 * @param context - Recent commits or a full diff.
 * @param locale - The user's language code.
 * @returns A promise that resolves to an AIResponse.
 */
export async function generatePRSummary(context: string, locale: string = 'en'): Promise<AIResponse> {
    const { provider, apiKey, needsKey } = activeProviderAndKey();
    if (!provider) return { text: '', error: 'AI Provider not found' };
    if (needsKey && !apiKey) return { text: '', error: 'API Key not configured' };

    const language = getLanguagePromptName(locale);
    return provider.generatePRSummary(context, language, apiKey);
}

import { getItem } from '../storageService';
import { useLanguage } from '../languageService';
import { AIResponse } from './core/types';
import { BaseAIProvider } from './core/BaseProvider';
import { GeminiProvider } from './providers/GeminiProvider';

const providers: Record<string, BaseAIProvider> = {
    gemini: new GeminiProvider()
};

const { getLanguagePromptName } = useLanguage();

function getActiveProvider(): BaseAIProvider | null {
    const providerId = getItem('gitbox_ai_provider') || 'gemini';
    return providers[providerId] || null;
}

export async function generateCommitMessage(diff: string, locale: string = 'en'): Promise<AIResponse> {
    const provider = getActiveProvider();
    const apiKey = getItem('gitbox_ai_api_key');

    if (!provider) return { text: '', error: 'AI Provider not found' };
    if (!apiKey) return { text: '', error: 'API Key not configured' };

    const language = getLanguagePromptName(locale);
    return provider.generateCommitMessage(diff, language, apiKey);
}

export async function explainChanges(diff: string, locale: string = 'en'): Promise<AIResponse> {
    const provider = getActiveProvider();
    const apiKey = getItem('gitbox_ai_api_key');

    if (!provider) return { text: '', error: 'AI Provider not found' };
    if (!apiKey) return { text: '', error: 'API Key not configured' };

    const language = getLanguagePromptName(locale);
    return provider.explainChanges(diff, language, apiKey);
}

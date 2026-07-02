import { BaseAIProvider } from '../core/BaseProvider';
import { AIResponse } from '../core/types';
import { GoogleGenAI } from "@google/genai";
import i18n from '../../../i18n';

/**
 * Integration for Google Gemini AI.
 */
export class GeminiProvider extends BaseAIProvider {
    id = 'gemini';
    name = 'Google Gemini';

    /**
     * Sends the prompt to Gemini using the official SDK.
     * @param prompt Full text prompt.
     * @param apiKey Google AI API Key.
     * @returns A promise with the AI result or error info.
     */

    async generate(prompt: string, apiKey: string): Promise<AIResponse> {
        try {
            // Using the new @google/genai SDK structure
            const ai = new GoogleGenAI({
                apiKey: apiKey
            });

            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash-lite",
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            });

            const text = result.text;

            if (!text) {
                throw new Error('Empty response from AI');
            }

            return { text: text.trim() };
        } catch (err: any) {
            let userMsg = String(err);

            // Check for explicit status code if available in the error object
            const status = err.status || err.response?.status || err.statusCode;

            if (status === 429 || userMsg.includes('429') || userMsg.includes('RESOURCE_EXHAUSTED') || userMsg.includes('quota')) {
                userMsg = (i18n.global as any).t('settings.ai_quota_exceeded') || 'API Quota Exceeded. Please check your plan at Google AI Studio.';
            }

            return { text: '', error: userMsg };
        }
    }
}

import { BaseAIProvider } from '../core/BaseProvider';
import { AIResponse } from '../core/types';
import { GoogleGenAI } from "@google/genai";

export class GeminiProvider extends BaseAIProvider {
    id = 'gemini';
    name = 'Google Gemini';

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
        } catch (err) {
            console.error('Gemini Provider error:', err);
            return { text: '', error: String(err) };
        }
    }
}

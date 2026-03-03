import { AIProvider, AIResponse } from './types';

export abstract class BaseAIProvider implements AIProvider {
    abstract id: string;
    abstract name: string;

    abstract generate(prompt: string, apiKey: string): Promise<AIResponse>;

    protected buildCommitPrompt(diff: string, language: string): string {
        return `
            You are an expert developer. Generate a concise, descriptive Git commit message based on the provided diff.
            
            RULES:
            - Use conventional commits format (e.g., feat: ..., fix: ..., chore: ...).
            - The message MUST be written in ${language}.
            - Do not use markdown backticks or code fences for the message.
            - Output ONLY the final commit message, no introductory text or quotes.
            
            DIFF:
            ${diff}
        `;
    }

    protected buildExplainPrompt(diff: string, language: string): string {
        return `
            You are an expert developer reviewing code changes. 
            Explain the provided diff in a clear and concise way.
            
            RULES:
            - Focus on the "why" and the high-level impact of the changes.
            - The explanation MUST be written in ${language}.
            - Use bullet points if there are multiple significant changes.
            
            DIFF:
            ${diff}
        `;
    }

    async generateCommitMessage(diff: string, language: string, apiKey: string): Promise<AIResponse> {
        return this.generate(this.buildCommitPrompt(diff, language), apiKey);
    }

    async explainChanges(diff: string, language: string, apiKey: string): Promise<AIResponse> {
        return this.generate(this.buildExplainPrompt(diff, language), apiKey);
    }
}

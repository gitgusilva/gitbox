export interface AIResponse {
    text: string;
    error?: string;
}

export interface AIProvider {
    id: string;
    name: string;
    generate(prompt: string, apiKey: string): Promise<AIResponse>;
    generateCommitMessage(diff: string, language: string, apiKey: string): Promise<AIResponse>;
    explainChanges(diff: string, language: string, apiKey: string): Promise<AIResponse>;
}

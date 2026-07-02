/**
 * Results of an AI operation.
 */
export interface AIResponse {
    /** The generated text content. */
    text: string;
    /** Error message if the operation failed. */
    error?: string;
}

/**
 * Interface that all AI providers must implement.
 */
export interface AIProvider {
    /** Unique identifier for the provider. */
    id: string;
    /** Display name. */
    name: string;

    /**
     * Core generation method.
     * @param prompt The full prompt to send.
     * @param apiKey The provider's API key.
     */
    generate(prompt: string, apiKey: string): Promise<AIResponse>;

    /**
     * Specifically generates a commit message.
     */
    generateCommitMessage(diff: string, language: string, apiKey: string): Promise<AIResponse>;

    /**
     * Specifically generates an explanation of changes.
     */
    explainChanges(diff: string, language: string, apiKey: string): Promise<AIResponse>;
}

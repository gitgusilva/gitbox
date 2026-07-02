import { BaseAIProvider } from '../core/BaseProvider';
import { AIResponse } from '../core/types';

/**
 * Runs a locally-installed AI CLI (Claude Code, Gemini CLI, Codex, …) via the
 * main process. The CLI handles its own authentication, so no API key is needed.
 */
export class CliProvider extends BaseAIProvider {
    id: string;
    name: string;
    private cliId: string;

    constructor(cliId: string) {
        super();
        this.cliId = cliId;
        this.id = 'cli:' + cliId;
        this.name = cliId;
    }

    async generate(prompt: string, _apiKey: string): Promise<AIResponse> {
        try {
            const res = await (window as any).gitbox.aiRunCli(this.cliId, prompt);
            if (res && res.text) return { text: String(res.text).trim() };
            return { text: '', error: (res && res.error) || 'No response from CLI' };
        } catch (e: any) {
            return { text: '', error: String(e && e.message || e) };
        }
    }
}

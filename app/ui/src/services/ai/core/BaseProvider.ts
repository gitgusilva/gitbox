import { AIProvider, AIResponse } from './types';

export abstract class BaseAIProvider implements AIProvider {
    abstract id: string;
    abstract name: string;

    abstract generate(prompt: string, apiKey: string): Promise<AIResponse>;

    protected buildCommitPrompt(diff: string, language: string): string {
        return `You are a senior software engineer writing a Git commit for a professional codebase. Analyze the diff and produce a high-quality, precise commit.

OUTPUT FORMAT (plain text only — no markdown, no code fences, no surrounding quotes):
Line 1: <type>(<optional scope>): <concise imperative subject, max 72 chars>
Line 2: (blank)
Body: 2-5 bullet points, each starting with "- ", describing WHAT changed and WHY. Group related changes and reference the affected files/areas/modules. Call out notable behavior changes, migrations or risks. Do NOT restate the diff line by line.

RULES:
- Conventional Commits type: feat, fix, refactor, perf, docs, test, chore, build, ci, style.
- Subject in the imperative mood, no trailing period.
- Infer the real intent from the code; be specific and professional.
- Write EVERYTHING (subject and body) in ${language}.
- Output ONLY the commit text — no preamble, no explanation of your reasoning.

DIFF:
${diff}`;
    }

    protected buildExplainPrompt(diff: string, language: string): string {
        return `You are a senior engineer performing a professional, analytical code review of the following change. Produce a clear, well-structured explanation a reviewer can trust.

LANGUAGE: Write the ENTIRE response in ${language}. This is mandatory regardless of the language of the code, identifiers, or diff. Do not answer in English unless ${language} is English.

STRUCTURE (use concise markdown):
## Summary
1-2 sentences on the overall purpose and impact.

## Changes by file
For each significant file, one bullet: \`path\` — what changed and, crucially, WHY.

## Impact & risks
Behavior changes, edge cases, migrations, performance/security implications, or things to double-check. Omit this section entirely if there is genuinely nothing noteworthy.

RULES:
- Explain intent and consequences, not a line-by-line readout of the diff.
- Be precise, concise and professional. No filler.
- Write the entire response in ${language}.

DIFF:
${diff}`;
    }

    async generateCommitMessage(diff: string, language: string, apiKey: string): Promise<AIResponse> {
        return this.generate(this.buildCommitPrompt(diff, language), apiKey);
    }

    async explainChanges(diff: string, language: string, apiKey: string): Promise<AIResponse> {
        return this.generate(this.buildExplainPrompt(diff, language), apiKey);
    }

    /**
     * Builds the specific PR summary prompt.
     * @param context The PR context, such as a log of recent commits or a full diff.
     * @param language The desired response language.
     * @returns The full prompt.
     */
    protected buildPRSummaryPrompt(context: string, language: string): string {
        return `
            You are an expert developer creating a Pull Request.
            Write a clear, professional PR title and a description.
            
            RULES:
            - The response MUST be in ${language}.
            - Provide the title on the first line, prefixed with "TITLE: ".
            - Provide the description starting on the next line, prefixed with "DESCRIPTION: ".
            - Mention what was changed, using bullet points for multiple changes.
            
            CONTEXT (Recent commits/changes):
            ${context}
        `;
    }

    async generatePRSummary(context: string, language: string, apiKey: string): Promise<AIResponse> {
        return this.generate(this.buildPRSummaryPrompt(context, language), apiKey);
    }
}

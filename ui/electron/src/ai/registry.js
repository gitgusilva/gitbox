/**
 * Registry of known AI coding CLIs. Single source of truth for discovery and
 * for running them. To support a new CLI, add one entry here.
 *
 * Fields:
 *  - id:      stable identifier used by the renderer (provider = `cli:<id>`).
 *  - label:   display name.
 *  - bins:    candidate executable names to look for (first found wins).
 *  - runArgs: argv to invoke it headlessly; the prompt is piped via stdin.
 *  - vendor:  who makes it (grouping/label only).
 */
const AI_CLIS = [
    { id: 'claude',       label: 'Claude Code',        vendor: 'Anthropic',   bins: ['claude'],                 runArgs: ['-p'] },
    { id: 'gemini-cli',   label: 'Gemini CLI',         vendor: 'Google',      bins: ['gemini'],                 runArgs: ['-p'] },
    { id: 'codex',        label: 'OpenAI Codex CLI',   vendor: 'OpenAI',      bins: ['codex'],                  runArgs: ['exec', '-'] },
    { id: 'cursor-agent', label: 'Cursor Agent',       vendor: 'Cursor',      bins: ['cursor-agent'],           runArgs: ['-p'] },
    { id: 'copilot',      label: 'GitHub Copilot CLI', vendor: 'GitHub',      bins: ['copilot'],                runArgs: ['-p'] },
    { id: 'qwen',         label: 'Qwen Code',          vendor: 'Alibaba',     bins: ['qwen'],                   runArgs: ['-p'] },
    { id: 'opencode',     label: 'OpenCode',           vendor: 'OpenCode',    bins: ['opencode'],               runArgs: ['run'] },
    { id: 'crush',        label: 'Crush',              vendor: 'Charm',       bins: ['crush'],                  runArgs: ['run'] },
    { id: 'goose',        label: 'Goose',              vendor: 'Block',       bins: ['goose'],                  runArgs: ['run', '-t'] },
    { id: 'amp',          label: 'Amp',                vendor: 'Sourcegraph', bins: ['amp'],                    runArgs: [] },
    { id: 'aider',        label: 'Aider',              vendor: 'Aider',       bins: ['aider'],                  runArgs: ['--no-git', '--yes', '--message-file', '-'] },
    { id: 'llm',          label: 'llm',                vendor: 'Simon Willison', bins: ['llm'],                 runArgs: [] },
    { id: 'aichat',       label: 'AIChat',             vendor: 'sigoden',     bins: ['aichat'],                 runArgs: [] },
    { id: 'mods',         label: 'Mods',               vendor: 'Charm',       bins: ['mods'],                   runArgs: [] },
    { id: 'ollama',       label: 'Ollama (local)',     vendor: 'Ollama',      bins: ['ollama'],                 runArgs: ['run', 'llama3.2'] },
    { id: 'antigravity',  label: 'Antigravity',        vendor: 'Google',      bins: ['antigravity'],            runArgs: ['-p'] }
];

module.exports = { AI_CLIS };

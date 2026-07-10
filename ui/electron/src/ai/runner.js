const { spawn } = require('child_process');
const { resolveAiCli } = require('./discovery');

/**
 * Run an AI CLI headlessly: spawn the resolved binary (no shell), pipe the
 * prompt via stdin, and return its stdout. Timeout-guarded so a CLI without a
 * non-interactive mode can't hang the request.
 * @returns {Promise<{text: string, error?: string}>}
 */
function runAiCli(id, prompt, { timeoutMs = 180000, maxBytes = 8 * 1024 * 1024 } = {}) {
    if (typeof prompt !== 'string' || !prompt.trim()) {
        return Promise.resolve({ text: '', error: 'Empty prompt' });
    }
    const resolved = resolveAiCli(id);
    if (!resolved) {
        return Promise.resolve({ text: '', error: `AI CLI not found or not runnable: ${id}` });
    }

    return new Promise((resolve) => {
        let out = '';
        let err = '';
        let settled = false;
        const finish = (r) => { if (!settled) { settled = true; resolve(r); } };

        // Some CLIs (e.g. Antigravity's `agy -p "<prompt>"`) take the prompt as a
        // positional ARGUMENT and ignore stdin; others read it from stdin. runArgs
        // + promptAsArg on the registry entry decides which.
        const args = resolved.promptAsArg ? [...resolved.runArgs, prompt] : resolved.runArgs;

        let child;
        try {
            child = spawn(resolved.path, args, { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (e) {
            return finish({ text: '', error: String((e && e.message) || e) });
        }

        const timer = setTimeout(() => {
            try { child.kill('SIGKILL'); } catch {}
            finish({ text: '', error: 'AI CLI timed out' });
        }, timeoutMs);

        child.stdout.on('data', (d) => {
            out += d;
            if (out.length > maxBytes) { try { child.kill('SIGKILL'); } catch {} }
        });
        child.stderr.on('data', (d) => { err += d; });
        child.on('error', (e) => { clearTimeout(timer); finish({ text: '', error: String((e && e.message) || e) }); });
        child.on('close', (code) => {
            clearTimeout(timer);
            const text = out.trim();
            if (text) finish({ text });
            else finish({ text: '', error: err.trim() || `AI CLI exited with code ${code}` });
        });

        // Feed the prompt via stdin only for CLIs that read it there; for
        // promptAsArg CLIs it's already on the command line, so just close stdin.
        try {
            if (!resolved.promptAsArg) child.stdin.write(prompt);
            child.stdin.end();
        } catch { /* ignore */ }
    });
}

module.exports = { runAiCli };

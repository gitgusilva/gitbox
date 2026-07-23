import { ref } from 'vue';

/**
 * Manual per-host git credentials.
 *
 * The OAuth integrations only cover github.com, gitlab.com and bitbucket.org.
 * Anything else — a self-hosted GitLab, Gitea, Azure DevOps — has no sign-in
 * flow, and a gitlab.com token is useless against another GitLab instance, so
 * those servers need a username and access token stored per host.
 *
 * Tokens are held by the main process, encrypted through the OS keychain, and
 * are never sent back here: this module can add, list and remove entries, but
 * cannot read a secret. That is deliberate — a token that never reaches the
 * renderer can't leak through the DOM, devtools, or a rogue dependency.
 */
export interface CredentialEntry {
    host: string;
    username: string;
    encrypted: boolean;
}

/** How well the machine can protect secrets. 'weak' means Linux without a
 *  keyring, where Electron falls back to a hardcoded key. */
export type ProtectionLevel = 'os' | 'weak' | 'none';

export const credentials = ref<CredentialEntry[]>([]);
export const protection = ref<ProtectionLevel>('os');

function api() {
    return (window as any).gitbox;
}

export async function loadCredentials() {
    try {
        credentials.value = (await api()?.credentialsList?.()) || [];
        protection.value = (await api()?.credentialProtection?.()) || 'none';
    } catch {
        credentials.value = [];
    }
}

/**
 * Accepts what a user is likely to paste — a bare host, a host:port, or a whole
 * clone URL — and reduces it to the host key auth resolution looks up. The port
 * is KEPT (127.0.0.1:3030 stays that way) so it matches the key the main process
 * derives from the origin, and so two servers on one host but different ports
 * don't share a credential. Keeping this here (rather than trusting the field)
 * means `http://server:3030/group/repo.git` and `server:3030` save to the same
 * entry instead of one silently never matching.
 */
export function normalizeHost(input: string): string {
    let value = String(input || '').trim().toLowerCase();
    if (!value) return '';
    value = value.replace(/^[a-z+]+:\/\//, '');   // scheme
    value = value.replace(/^[^@/]*@/, '');        // user[:pass]@
    value = value.split('/')[0];                  // path (keeps any :port)
    // A colon before a non-numeric segment is the scp-style `host:path`, not a
    // port — drop it. A numeric `:port` is part of the authority and stays.
    const colon = value.indexOf(':');
    if (colon !== -1 && !/^\d+$/.test(value.slice(colon + 1))) {
        value = value.slice(0, colon);
    }
    return value;
}

export async function saveCredential(host: string, username: string, token: string) {
    const key = normalizeHost(host);
    if (!key || !token) return false;
    await api()?.credentialSave?.(key, username.trim(), token);
    await loadCredentials();
    return true;
}

/** Holds a credential for this session only (memory, never disk) — the askpass
 *  "don't remember" path. No loadCredentials(): it must not appear as saved. */
export async function saveSessionCredential(host: string, username: string, token: string) {
    const key = normalizeHost(host);
    if (!key || !token) return false;
    await api()?.credentialSaveSession?.(key, username.trim(), token);
    return true;
}

export async function removeCredential(host: string) {
    await api()?.credentialRemove?.(host);
    await loadCredentials();
}

/**
 * The main process tags an HTTP auth failure with `[gitbox-auth:need|reject:host]`
 * so the renderer can react to it without parsing localized prose. `need` means
 * nothing was sent; `reject` means a saved credential was refused.
 */
const AUTH_MARKER = /\[gitbox-auth:(need|reject):([^\]]+)\]/;

export function parseAuthMarker(message: string): { kind: 'need' | 'reject'; host: string } | null {
    const m = AUTH_MARKER.exec(String(message || ''));
    return m ? { kind: m[1] as 'need' | 'reject', host: m[2] } : null;
}

/** Removes the marker so it never reaches the UI. */
export function stripAuthMarker(message: string): string {
    return String(message || '').replace(AUTH_MARKER, '').replace(/\s+$/, '');
}

/**
 * Opens the credential prompt and resolves with what the user entered, or null
 * if they dismissed it. Import lazily to avoid a cycle with modalService.
 */
export async function requestCredentials(host: string, rejected = false): Promise<{ username: string; password: string; remember: boolean } | null> {
    const { credentialPrompt } = await import('./modalService');
    return new Promise((resolve) => {
        credentialPrompt.value = {
            host,
            rejected,
            resolve: (creds) => { credentialPrompt.value = null; resolve(creds); },
        };
    });
}

/**
 * Runs a remote operation and, if it fails purely for want of (or with refused)
 * credentials, raises the askpass prompt, keeps the entered credentials — on disk
 * only if the user opted in, otherwise for the session — and retries. Loops up to
 * `maxPrompts` so a mistyped password re-prompts (SourceGit-style). A cancelled
 * prompt, an exhausted retry, or any non-auth error is re-thrown for the caller.
 *
 * `isRetry` lets a caller drop credentials it passed inline on the first try, so
 * the just-entered ones win instead of failing identically.
 */
export async function withCredentialRetry<T>(fn: (isRetry: boolean) => Promise<T>, maxPrompts = 3): Promise<T> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await fn(attempt > 0);
        } catch (err: any) {
            const info = parseAuthMarker(err?.message ?? String(err));
            if (!info || attempt >= maxPrompts) throw err;
            attempt += 1;

            const creds = await requestCredentials(info.host, info.kind === 'reject' || attempt > 1);
            if (!creds || !creds.password) throw err;

            // Persisted before the retry so the operation (which re-resolves from
            // the store/session) picks them up. Opt-in decides disk vs. memory.
            if (creds.remember) await saveCredential(info.host, creds.username, creds.password);
            else await saveSessionCredential(info.host, creds.username, creds.password);
        }
    }
}

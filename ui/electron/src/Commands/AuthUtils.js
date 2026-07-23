const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const { credentialsFromGit } = require('./GitCredentialHelpers');

/** Providers GitBox can sign in to, and how their hosts are recognised. Matching
 *  is on a hostname substring rather than the canonical domain so self-hosted
 *  instances (gitlab.acme.com, github.acme.com) resolve to the right session. */
const PROVIDERS = [
    { id: 'github', label: 'GitHub', match: /github/ },
    { id: 'gitlab', label: 'GitLab', match: /gitlab/ },
    { id: 'bitbucket', label: 'Bitbucket', match: /bitbucket/ },
];

/** Store key holding manual per-host credentials: { host: {username, token} }. */
const CREDENTIALS_KEY = 'gitbox_credentials';

/** Reads one key out of the settings file, parsed. Returns {} when absent or
 *  unreadable — auth resolution must never throw at the caller. */
function readStoreKey(key) {
    try {
        const storePath = path.join(app.getPath('userData'), 'gitbox_config.json');
        const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        const raw = store[key];
        if (!raw) return {};
        return (typeof raw === 'string' ? JSON.parse(raw) : raw) || {};
    } catch (e) {
        return {};
    }
}

/** Reads the saved integration sessions, or {} when none/unreadable. */
function readSessions() {
    return readStoreKey('gitbox_integrations');
}

/** True for remotes libgit2 cannot authenticate here — it is built with
 *  USE_SSH=OFF, so git@host:… / ssh:// URLs have no transport at all. */
function isSshRemote(remoteUrl) {
    const u = String(remoteUrl || '');
    return u.startsWith('ssh://') || /^[^/]+@[^/]+:/.test(u);
}

/** The provider entry a remote URL belongs to, or null for an unknown host. */
function providerForUrl(remoteUrl) {
    const url = String(remoteUrl || '').toLowerCase();
    return PROVIDERS.find(p => p.match.test(url)) || null;
}

/**
 * Host portion of a remote URL, INCLUDING the port when the URL carries one, so
 * it reads back exactly as the origin does (127.0.0.1:3030) — both in messages
 * and as the credential key. Keeping the port apart means a self-hosted GitLab
 * and Gitea on the same host but different ports get their own credential.
 * Falls back to the raw URL when it can't be parsed.
 */
function hostOf(remoteUrl) {
    const u = String(remoteUrl || '');
    const m = u.match(/^[a-z+]+:\/\/(?:[^@/]*@)?([^/:]+(?::\d+)?)/i) || u.match(/^[^/]+@([^/:]+):/);
    return m ? m[1] : u;
}

/**
 * Credentials configured inside GitBox itself: what the user typed under
 * Settings first, then the OAuth integrations. A provider session only applies
 * to that provider's own hosts — a gitlab.com token is worthless against someone
 * else's GitLab instance.
 *
 * @param {string} remoteUrl
 * @returns {{username: string, token: string, source: 'manual'|'integration'|null}}
 */
function getCredentialsForUrl(remoteUrl) {
    const host = hostOf(remoteUrl).toLowerCase();
    // Session entry (askpass "don't remember") wins over the persisted one.
    const manual = require('../credentialStore').getResolved(host);
    if (manual && manual.token) {
        return { username: manual.username || '', token: manual.token, source: 'manual' };
    }

    const provider = providerForUrl(remoteUrl);
    const session = provider ? readSessions()[provider.id] : null;
    // The renderer stores sessions as { accessToken, user }; older builds wrote
    // `token`. Accept both so a saved login is never silently ignored (an empty
    // token makes libgit2 fail with "authentication required but no callback set").
    const token = (session && (session.accessToken || session.token)) || '';
    if (token) return { username: 'oauth2', token, source: 'integration' };

    return { username: '', token: '', source: null };
}

/**
 * Full credential resolution, git's configuration first.
 *
 * Someone who already pushes to a server from the terminal should not have to
 * configure it again here, so a credential helper answering for the host wins —
 * including over an entry typed in Settings. That ordering is deliberate; the
 * Settings UI flags any host git is answering for, so a typed entry that is
 * being overridden says so instead of silently doing nothing.
 *
 * @param {object} addon      native addon (needs configEntries)
 * @param {string} remoteUrl
 * @returns {Promise<{username: string, token: string, source: 'git'|'manual'|'integration'|null, helper?: string}>}
 */
async function resolveCredentials(addon, remoteUrl) {
    if (remoteUrl) {
        try {
            const fromGit = await credentialsFromGit(addon, remoteUrl);
            if (fromGit && fromGit.token) {
                return { username: fromGit.username, token: fromGit.token, source: 'git', helper: fromGit.helper };
            }
        } catch (e) {
            // A broken helper must not block the app's own credentials.
        }
    }
    return getCredentialsForUrl(remoteUrl);
}

/**
 * Retrieves authentication token from local store
 * @param {string} remoteUrl
 */
function getTokenForUrl(remoteUrl) {
    return getCredentialsForUrl(remoteUrl).token || null;
}

/**
 * Returns an authenticated URL for git operations
 * @param {string} remoteUrl 
 */
async function getAuthUrl(remoteUrl) {
    if (!remoteUrl || remoteUrl.startsWith('git@') || remoteUrl.startsWith('ssh://')) {
        return remoteUrl;
    }
    const token = getTokenForUrl(remoteUrl);
    if (!token) return remoteUrl;
    try {
        const u = new URL(remoteUrl);
        u.username = 'oauth2';
        u.password = token;
        return u.toString();
    } catch (e) {
        return remoteUrl;
    }
}

/**
 * Resolves the remote URL for a given remote name
 * @param {string} repoPath 
 * @param {string} remoteName 
 */
async function resolveRemoteUrl(repoPath, remoteName) {
    try {
        const { stdout } = await execFileAsync('git', ['remote', 'get-url', remoteName || 'origin'], { cwd: repoPath });
        return stdout.trim();
    } catch (e) {
        return '';
    }
}

/**
 * Resolve the stored auth token for a repo's remote WITHOUT shelling out to
 * git — the native addon reports the remote URL, which selects the token.
 * @param {object} addon native addon (must expose remoteUrl)
 * @param {string} repoPath
 * @param {string} remoteName
 * @returns {string} token or '' when none is configured
 */
async function getTokenForRemote(addon, repoPath, remoteName) {
    return (await remoteAuth(addon, repoPath, remoteName)).token;
}

/**
 * Resolves the remote URL and the credentials to use for it in one step, so a
 * command that fails can explain WHICH remote and WHICH account were involved.
 * @returns {Promise<{url: string, token: string, username: string, source: string|null}>}
 */
async function remoteAuth(addon, repoPath, remoteName) {
    let url = '';
    try {
        if (addon && typeof addon.remoteUrl === 'function') {
            url = addon.remoteUrl(repoPath, remoteName || 'origin') || '';
        }
    } catch (e) {
        url = '';
    }
    const { username, token, source } = await resolveCredentials(addon, url);
    return { url, token, username, source };
}

// libgit2's wording for "the server wanted credentials and didn't get usable
// ones". The first is what it raises when no credential callback was set at all
// (our case when no token is stored); the rest are what it raises when a token
// WAS sent and the server refused it.
const NO_CREDENTIALS = /authentication required but no (callback set|credentials are configured)/i;
// SSH failures are their own category: the credentials are keys, not tokens, so
// the fix is never "connect an account". Each of these was observed against a
// real SSH server.
const SSH_NO_KEY = /authentication required but no callback set|callback returned unsupported credentials type|failed to authenticate ssh session/i;
const SSH_HOSTKEY = /host key|known_hosts|hostkey|certificate check failed|user rejected certificate/i;
const REJECTED = /too many redirects or authentication replays|401|403|authentication failed|invalid credentials|unexpected http status/i;
// Messages libgit2 produces when credentials WERE sent and refused, but that
// mean something else entirely when nothing was sent — so they only count as a
// rejection if we actually had credentials for the host. Both were observed
// against real servers replying 401 to a wrong token:
//   - the config leak: libgit2's HTTP transport gives up after repeated 401s and
//     surfaces an unrelated internal config lookup error;
//   - the "we do not support" one: servers (Gitea among them) drop the
//     WWW-Authenticate header on a failed retry, so libgit2 finds no scheme it
//     can use. With no credentials sent it really does mean an unsupported
//     scheme (NTLM/Negotiate), which is a different problem.
const REJECTED_WHEN_SENT = /config value 'http\.followRedirects' was not found|requires authentication that we do not support/i;

/**
 * Turns a libgit2 auth failure into a message that says what to do about it.
 * Anything that isn't an auth failure is returned untouched — the underlying
 * message is almost always the more useful one.
 *
 * @param {Error|any} err   the error the addon rejected with
 * @param {string} url      remote URL the operation targeted ('' if unknown)
 * @param {string} action   verb for the message, e.g. 'fetch from'
 * @param {string|null} source  where the credentials came from, if any
 * @returns {Error} the error to throw to the renderer
 */
function explainAuthError(err, url, action, source = undefined) {
    const message = String((err && err.message) || err || '');
    const ssh = isSshRemote(url);
    // SSH is supported now (static libssh2), so a transport error here means the
    // build lost its SSH support rather than the URL being unusable.
    const sshUnsupported = ssh && /unsupported url protocol|unsupported transport|this transport isn't implemented/i.test(message);
    // `source` is passed in by callers that already resolved; fall back to the
    // synchronous (GitBox-only) view for the few that haven't.
    const sent = source === undefined ? getCredentialsForUrl(url).source : source;
    const isAuth = NO_CREDENTIALS.test(message) || REJECTED.test(message) ||
        (!!sent && REJECTED_WHEN_SENT.test(message));
    const where = url ? ` ${hostOf(url)}` : '';

    if (ssh) {
        if (sshUnsupported) {
            return new Error(
                `This build of GitBox has no SSH support, so it can't ${action} ${url}. ` +
                `Use the repository's https:// URL instead.`);
        }
        if (SSH_HOSTKEY.test(message)) {
            return new Error(
                `The SSH host key for${where} isn't in your known_hosts file, so GitBox stopped rather than trust it blindly. ` +
                `Connect once with \`ssh ${hostOf(url)}\` to record it, then try again.`);
        }
        if (SSH_NO_KEY.test(message) || isAuth) {
            return new Error(
                `${hostOf(url) || 'The server'} refused every SSH key GitBox tried (ssh-agent, then ~/.ssh). ` +
                `Add your key to the server, load it with \`ssh-add\` if it has a passphrase, or use the https:// URL instead.`);
        }
        return err instanceof Error ? err : new Error(message);
    }

    if (!isAuth) return err instanceof Error ? err : new Error(message);

    const provider = providerForUrl(url);

    // Machine marker the renderer parses to raise a username/password prompt for
    // this host (SourceGit-style), then strips before showing the message. Only
    // for http(s), where a username/token is the fix — SSH returns above, and a
    // marker is pointless without a host to key the credential on.
    //   need   → nothing was sent; ask and save.
    //   reject → what we had was refused; ask again, prefilled where possible.
    const markerHost = hostOf(url);
    const tag = (kind) => (markerHost && markerHost !== url ? ` [gitbox-auth:${kind}:${markerHost}]` : '');

    // Nothing to send. Point at whichever way of supplying credentials fits the
    // host: a provider sign-in for the ones GitBox knows, manual per-host
    // credentials for a self-hosted server it doesn't.
    if (!sent) {
        return provider
            ? new Error(
                `No ${provider.label} account connected — connect one in Settings › Integrations to ${action}${where}, ` +
                `or add a username and access token for${where} in Settings › Integrations.`)
            : new Error(
                `No credentials saved for${where || ' this remote'}. Add a username and access token for that host in ` +
                `Settings › Integrations — GitBox only signs in automatically to github.com, gitlab.com and bitbucket.org.` +
                tag('need'));
    }

    // Something was sent and refused. Manual credentials and an OAuth session
    // are fixed in different places, so name the right one.
    if (sent === 'git') {
        return new Error(
            `${hostOf(url) || 'The server'} refused the credentials from your git configuration. Update them with your ` +
            `credential helper, or save a username and access token for that host in Settings › Integrations.` +
            tag('reject'));
    }
    if (sent === 'manual') {
        return new Error(
            `${hostOf(url) || 'The server'} refused the saved credentials. Check the username and access token for that host ` +
            `in Settings › Integrations — the token may have expired or may not grant access to this repository.` +
            tag('reject'));
    }
    return new Error(
        `${provider ? provider.label : 'The server'} refused the saved credentials for${where}. Reconnect the account in ` +
        `Settings › Integrations — the token may have expired or may not grant access to this repository.`);
}

module.exports = {
    getTokenForUrl, getCredentialsForUrl, resolveCredentials, getAuthUrl, resolveRemoteUrl,
    getTokenForRemote, remoteAuth, explainAuthError, isSshRemote, providerForUrl, hostOf,
    CREDENTIALS_KEY,
};

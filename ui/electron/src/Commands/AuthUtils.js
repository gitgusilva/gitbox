const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

/**
 * Retrieves authentication token from local store
 * @param {string} remoteUrl 
 */
function getTokenForUrl(remoteUrl) {
    try {
        const storePath = path.join(app.getPath('userData'), 'gitbox_config.json');
        const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        const raw = store['gitbox_integrations'];
        if (!raw) return null;
        const sessions = typeof raw === 'string' ? JSON.parse(raw) : raw;

        const url = remoteUrl.toLowerCase();
        let token = null;
        if (url.includes('github.com') && sessions.github) token = sessions.github.token;
        if (url.includes('gitlab.com') && sessions.gitlab) token = sessions.gitlab.token;
        if (url.includes('bitbucket.org') && sessions.bitbucket) token = sessions.bitbucket.token;
        return token || null;
    } catch (e) {
        return null;
    }
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
function getTokenForRemote(addon, repoPath, remoteName) {
    try {
        const url = addon && typeof addon.remoteUrl === 'function'
            ? addon.remoteUrl(repoPath, remoteName || 'origin')
            : '';
        return getTokenForUrl(url || '') || '';
    } catch (e) {
        return '';
    }
}

module.exports = { getTokenForUrl, getAuthUrl, resolveRemoteUrl, getTokenForRemote };

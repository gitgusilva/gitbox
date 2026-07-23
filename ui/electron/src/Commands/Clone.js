/**
 * @fileoverview Clone Command — native HTTPS/SSH clone via libgit2 (no git CLI).
 */
const Command = require('./Command');
const path = require('path');

/**
 * Clone Command Class
 */
class Clone extends Command {

    /**
     * Clone a repository into `targetDir`, creating a subfolder for it. Auth for a
     * private origin comes from (in order) credentials typed into the clone dialog,
     * then the host's saved credential / git credential helper.
     *
     * @param {string} url        remote URL (https://… or git@…)
     * @param {string} targetDir  parent directory to clone into
     * @param {{name?: string, username?: string, password?: string, remember?: boolean}} [options]
     *   name     — local folder name (defaults to the name implied by the URL)
     *   username/password — credentials for a private origin, entered in the dialog
     *   remember — persist those credentials encrypted (opt-in); otherwise they are
     *              kept only for this session so later fetch/push still work.
     * @returns {{path: string, name: string}} the cloned repo path + name
     */
    async execute(url, targetDir, options = {}) {
        const { resolveCredentials, explainAuthError, hostOf, isSshRemote } = require('./AuthUtils');
        const opts = options || {};

        const derived = (String(url).split('/').pop() || 'repo').replace(/\.git$/i, '');
        const name = (opts.name && String(opts.name).trim()) || derived;
        const dest = path.join(targetDir, name);

        // Credentials typed in the dialog win — the user is telling us exactly what
        // to use for this origin. Otherwise fall back to whatever is stored for the
        // host (saved entry, git helper, or connected account).
        let username = '';
        let token = '';
        let source = null;
        const typed = opts.password && String(opts.password).length > 0;
        if (typed) {
            username = String(opts.username || '').trim();
            token = String(opts.password);
            source = 'manual';
        } else {
            ({ username, token, source } = await resolveCredentials(this.addon, url));
        }

        try {
            // addon.clone runs off the main thread — await so the folder only reports
            // success once the clone actually finishes.
            await this.addon.clone(url, dest, token, username);

            // A repo cloned with typed credentials needs them again for every later
            // fetch/push. Keep them for the host — encrypted on disk only when the
            // user opted in ("remember"), otherwise in memory for this session — so
            // they aren't re-entered. Never for SSH, whose auth is a key.
            if (typed && !isSshRemote(url)) {
                try {
                    const store = require('../credentialStore');
                    const key = hostOf(url).toLowerCase();
                    if (opts.remember) store.save(key, username, token);
                    else store.saveSession(key, username, token);
                } catch (e) { /* saving is a convenience; a failure must not fail the clone */ }
            }
            return { path: dest, name };
        } catch (e) {
            throw explainAuthError(e, url, 'clone', source);
        }
    }
}

module.exports = Clone;

/**
 * @fileoverview Clone Command — native HTTPS clone via libgit2 (no git CLI).
 */
const Command = require('./Command');
const path = require('path');

/**
 * Clone Command Class
 */
class Clone extends Command {

    /**
     * Clone a repository into `targetDir`, creating a subfolder named after the
     * repo. Auth (private repos) uses the stored token for the URL's host.
     * @param {string} url        remote URL (https://…)
     * @param {string} targetDir  parent directory to clone into
     * @returns {{path: string, name: string}} the cloned repo path + name
     */
    async execute(url, targetDir) {
        const { getTokenForUrl } = require('./AuthUtils');
        try {
            const name = (String(url).split('/').pop() || 'repo').replace(/\.git$/i, '');
            const dest = path.join(targetDir, name);
            const token = getTokenForUrl(url) || '';
            this.addon.clone(url, dest, token);
            return { path: dest, name };
        } catch (e) {
            throw new Error(e.message);
        }
    }
}

module.exports = Clone;

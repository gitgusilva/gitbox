/**
 * @fileoverview Init Command — native repository creation via libgit2 (no git CLI).
 */
const Command = require('./Command');
const path = require('path');

/**
 * Init Command Class
 */
class Init extends Command {

    /**
     * Initialize a new repository. Creates `targetDir/name` (or `targetDir`
     * when no name is given) with the requested default branch.
     * @param {string} targetDir     parent directory
     * @param {string} name          repo folder name (optional)
     * @param {string} defaultBranch initial HEAD branch (e.g. 'main')
     * @returns {{path: string, name: string}}
     */
    async execute(targetDir, name, defaultBranch) {
        try {
            const dest = name ? path.join(targetDir, name) : targetDir;
            this.addon.initRepo(dest, defaultBranch || '');
            return { path: dest, name: name || path.basename(dest) };
        } catch (e) {
            throw new Error(e.message);
        }
    }
}

module.exports = Init;

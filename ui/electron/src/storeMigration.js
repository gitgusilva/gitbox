/**
 * @fileoverview One-time adoption of the settings file written by older builds.
 *
 * Until the setName() ordering was fixed, userData resolved to a different
 * directory depending on how GitBox was started: <appData>/gitbox for packaged
 * builds (the logger touched userData before setName ran) and <appData>/GitBox
 * for `npm start`. Each got its own gitbox_config.json, so integrations, repo
 * list and preferences saved in one were invisible to the other. Now that both
 * resolve to <appData>/GitBox, the older file has to be carried over — otherwise
 * the fix reads to the user as "the update wiped my settings".
 */
const fs = require('fs');
const path = require('path');

/** Directory names previous builds could have used, most recent first. */
const LEGACY_DIRS = ['gitbox', 'gitbox-electron'];

/** A store file counts only if it parses to a non-empty object — the crash-time
 *  truncation that non-atomic writes could leave behind produces a 0-byte file,
 *  which must not win over real settings. */
function readableStore(file) {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

/**
 * Copies the newest usable legacy store into `storePath` when the current one
 * holds nothing. Never overwrites live settings, and copies (rather than moves)
 * so an older build keeps working if the user rolls back.
 *
 * @param {Electron.App} app
 * @param {string} storePath  the current gitbox_config.json path
 * @returns {string|null} the directory adopted from, or null if nothing was done
 */
function adoptLegacyStore(app, storePath) {
    try {
        if (readableStore(storePath)) return null;   // current settings exist — leave them alone

        const appData = app.getPath('appData');
        const current = path.dirname(storePath);

        for (const dir of LEGACY_DIRS) {
            const candidate = path.join(appData, dir, 'gitbox_config.json');
            if (path.resolve(candidate) === path.resolve(storePath)) continue;
            const legacy = readableStore(candidate);
            if (!legacy) continue;

            fs.mkdirSync(current, { recursive: true });
            fs.writeFileSync(storePath, JSON.stringify(legacy));
            return path.dirname(candidate);
        }
        return null;
    } catch (e) {
        // Migration is best-effort: a failure here must never stop the app from
        // starting — the user just sees a fresh configuration.
        return null;
    }
}

module.exports = { adoptLegacyStore, readableStore };

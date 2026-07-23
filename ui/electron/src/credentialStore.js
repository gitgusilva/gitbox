/**
 * @fileoverview Encrypted storage for per-host git credentials.
 *
 * Access tokens are as good as passwords, so they don't belong in the settings
 * file: that file is world-readable by default, is copied around by the store
 * migration, and shows up verbatim in a bug report. Tokens live here instead —
 * in their own file, readable only by the user, with each secret encrypted
 * through Electron's safeStorage (the OS keychain: libsecret/kwallet on Linux,
 * Keychain on macOS, DPAPI on Windows). The encryption key never touches disk.
 *
 * The renderer never receives a token back. It saves one, lists hosts, removes
 * entries — the plaintext only ever exists in the main process, at the moment a
 * remote operation needs it.
 */
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const FILE_NAME = 'gitbox_credentials.json';
/** Owner-only. The whole point is that another account on the machine can't read it. */
const FILE_MODE = 0o600;

function filePath() {
    return path.join(app.getPath('userData'), FILE_NAME);
}

/**
 * How well secrets can be protected on this machine.
 *  - 'os'    : a real OS keychain is backing safeStorage
 *  - 'weak'  : Linux with no keyring — Electron falls back to a hardcoded key,
 *              which stops a casual read but is not real protection
 *  - 'none'  : no encryption at all; tokens would be stored as text
 */
function protectionLevel() {
    try {
        if (!safeStorage.isEncryptionAvailable()) return 'none';
        const backend = typeof safeStorage.getSelectedStorageBackend === 'function'
            ? safeStorage.getSelectedStorageBackend()
            : 'unknown';
        return backend === 'basic_text' ? 'weak' : 'os';
    } catch (e) {
        return 'none';
    }
}

function readFile() {
    try {
        return JSON.parse(fs.readFileSync(filePath(), 'utf-8')) || {};
    } catch (e) {
        return {};
    }
}

function writeFile(data) {
    const target = filePath();
    const tmp = `${target}.tmp`;
    // Same atomic write as the settings store: a crash mid-write must not leave
    // a truncated file. The mode is set on creation so the secrets are never
    // briefly world-readable.
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: FILE_MODE });
    fs.renameSync(tmp, target);
    try { fs.chmodSync(target, FILE_MODE); } catch (e) { /* best effort on Windows */ }
}

/** Encrypts a secret, or marks it as stored in the clear when it can't be. */
function seal(token) {
    if (protectionLevel() === 'none') return { enc: 'plain', token };
    try {
        return { enc: 'safeStorage', token: safeStorage.encryptString(token).toString('base64') };
    } catch (e) {
        return { enc: 'plain', token };
    }
}

/** Reverses seal(). Returns '' when the entry can't be decrypted — which happens
 *  legitimately when the OS keychain changed or the file came from another
 *  machine, and must degrade to "no credentials" rather than throwing. */
function unseal(entry) {
    if (!entry) return '';
    if (entry.enc === 'safeStorage') {
        try {
            return safeStorage.decryptString(Buffer.from(entry.token, 'base64'));
        } catch (e) {
            return '';
        }
    }
    return entry.token || '';
}

/** Hosts with credentials, without any secret. Safe to send to the renderer. */
function list() {
    const data = readFile();
    return Object.keys(data).sort().map(host => ({
        host,
        username: data[host].username || '',
        encrypted: data[host].enc === 'safeStorage',
    }));
}

/** @returns {{username: string, token: string}|null} — main process only. */
function get(host) {
    const entry = readFile()[String(host || '').toLowerCase()];
    if (!entry) return null;
    const token = unseal(entry);
    return token ? { username: entry.username || '', token } : null;
}

/**
 * In-memory credentials for the current run only — never written to disk. This
 * is the askpass default: a user who declines "remember on this device" still
 * shouldn't be prompted again for the same host within the session. Cleared when
 * the app quits.
 */
const sessionCreds = Object.create(null);

function saveSession(host, username, token) {
    const key = String(host || '').toLowerCase();
    if (!key || !token) return false;
    sessionCreds[key] = { username: String(username || ''), token: String(token) };
    return true;
}

/**
 * Credentials to actually authenticate with: the session entry wins over the
 * persisted one (it is the most recent thing the user typed). Used by auth
 * resolution — NOT by list(), so session-only secrets never show as saved.
 * @returns {{username: string, token: string}|null}
 */
function getResolved(host) {
    const key = String(host || '').toLowerCase();
    if (sessionCreds[key]) return { username: sessionCreds[key].username, token: sessionCreds[key].token };
    return get(host);
}

function save(host, username, token) {
    const key = String(host || '').toLowerCase();
    if (!key || !token) return false;
    const data = readFile();
    data[key] = { username: String(username || ''), ...seal(String(token)) };
    writeFile(data);
    return true;
}

function remove(host) {
    const data = readFile();
    delete data[String(host || '').toLowerCase()];
    writeFile(data);
    return true;
}

/**
 * Moves credentials written before encryption existed out of the settings file.
 *
 * Runs before the settings store is read, so rewriting that file here can't race
 * its in-memory cache. Deleting the old key matters as much as re-encrypting:
 * leaving the plaintext copy behind would make the encryption cosmetic.
 *
 * @param {string} settingsPath  path to gitbox_config.json
 * @returns {number} how many entries were migrated
 */
function migrateFromSettings(settingsPath) {
    let settings;
    try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (e) {
        return 0;
    }
    const raw = settings && settings.gitbox_credentials;
    if (!raw) return 0;

    let legacy;
    try {
        legacy = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
        legacy = null;
    }

    let moved = 0;
    if (legacy && typeof legacy === 'object') {
        const data = readFile();
        for (const [host, value] of Object.entries(legacy)) {
            if (!value || !value.token) continue;
            const key = String(host).toLowerCase();
            if (data[key]) continue;                       // already migrated
            data[key] = { username: value.username || '', ...seal(String(value.token)) };
            moved += 1;
        }
        if (moved) writeFile(data);
    }

    delete settings.gitbox_credentials;
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings));
    } catch (e) {
        return moved;
    }
    return moved;
}

/** Tightens permissions on the settings file itself — it still holds OAuth
 *  session tokens, and shipped as world-readable (0644). */
function protectSettingsFile(settingsPath) {
    try {
        fs.chmodSync(settingsPath, FILE_MODE);
    } catch (e) { /* file may not exist yet, or Windows */ }
}

module.exports = {
    list, get, getResolved, save, saveSession, remove, migrateFromSettings, protectionLevel,
    protectSettingsFile, FILE_NAME,
};

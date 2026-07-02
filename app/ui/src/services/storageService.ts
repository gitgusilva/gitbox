/**
 * Retrieves a value from the persistent store (Electron store or LocalStorage).
 * @param key - Unique setting key.
 * @returns The stored string value or null if not found.
 */
export function getItem(key: string): string | null {
    if (window.gitbox && window.gitbox.storeGet) {
        return window.gitbox.storeGet(key) || null;
    }
    return localStorage.getItem(key);
}

/**
 * Persists a value to the store.
 * @param key - Unique setting key.
 * @param value - The string value to store.
 */
export function setItem(key: string, value: string): void {
    if (window.gitbox && window.gitbox.storeSet) {
        window.gitbox.storeSet(key, value);
    } else {
        localStorage.setItem(key, value);
    }
}

/**
 * Removes a value from the store.
 * @param key - Unique setting key to delete.
 */
export function removeItem(key: string): void {
    if (window.gitbox && window.gitbox.storeDelete) {
        window.gitbox.storeDelete(key);
    } else {
        localStorage.removeItem(key);
    }
}

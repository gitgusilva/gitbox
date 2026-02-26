export function getItem(key: string): string | null {
    if (window.gitbox && window.gitbox.storeGet) {
        return window.gitbox.storeGet(key) || null;
    }
    return localStorage.getItem(key);
}

export function setItem(key: string, value: string): void {
    if (window.gitbox && window.gitbox.storeSet) {
        window.gitbox.storeSet(key, value);
    } else {
        localStorage.setItem(key, value);
    }
}

export function removeItem(key: string): void {
    if (window.gitbox && window.gitbox.storeDelete) {
        window.gitbox.storeDelete(key);
    } else {
        localStorage.removeItem(key);
    }
}

import { onMounted, onUnmounted } from 'vue';

export type ShortcutCallback = (e: KeyboardEvent) => void;

export interface ShortcutMeta {
    pattern: string;
    titleKey?: string;
    descriptionKey?: string;
    category?: string;
    action: ShortcutCallback;
}

const registry = new Map<string, ShortcutMeta[]>();

function normalizeKeyPattern(pattern: string): string {
    const parts = pattern.toLowerCase().split(/[+\s]+/).map(p => p.trim()).filter(Boolean);
    const modifiers = new Set<string>();
    let mainKey = '';

    for (const part of parts) {
        if (['ctrl', 'control', 'cmd', 'command', 'meta'].includes(part)) modifiers.add('ctrl');
        else if (['alt', 'option'].includes(part)) modifiers.add('alt');
        else if (['shift'].includes(part)) modifiers.add('shift');
        else mainKey = part;
    }

    const result: string[] = [];
    if (modifiers.has('ctrl')) result.push('ctrl');
    if (modifiers.has('alt')) result.push('alt');
    if (modifiers.has('shift')) result.push('shift');
    if (mainKey) result.push(mainKey);

    return result.join('+');
}

/**
 * Registers a keyboard shortcut.
 * @param pattern e.g., "Ctrl+T", "Ctrl+Shift+E", "Escape"
 * @param action Callback payload triggered when the shortcut matches
 * @param meta Optional translation keys and category information
 * @returns A function to unregister the shortcut
 */
export function registerShortcut(
    pattern: string,
    action: ShortcutCallback,
    meta?: { titleKey?: string; descriptionKey?: string; category?: string }
): () => void {
    const normalized = normalizeKeyPattern(pattern);

    if (!registry.has(normalized)) {
        registry.set(normalized, []);
    }

    const payload: ShortcutMeta = {
        pattern: normalized,
        action,
        ...meta
    };

    registry.get(normalized)!.push(payload);

    return () => {
        const list = registry.get(normalized);
        if (list) {
            const idx = list.findIndex(l => l.action === action);
            if (idx > -1) {
                list.splice(idx, 1);
            }
            if (list.length === 0) {
                registry.delete(normalized);
            }
        }
    };
}

export function initGlobalShortcuts() {
    const handleKeydown = (e: KeyboardEvent) => {
        // Don't trigger if user is in an input field, UNLESS it's a modifier shortcut
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) ||
            (e.target as HTMLElement).isContentEditable;

        const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

        // Allow ctrl/cmd shortcuts even in inputs, but avoid single keys or shift+keys
        if (isInput && !hasModifier) return;

        const keys: string[] = [];
        if (e.ctrlKey || e.metaKey) keys.push('ctrl');
        if (e.altKey) keys.push('alt');
        if (e.shiftKey) keys.push('shift');

        let key = e.key.toLowerCase();

        // If the key itself is a modifier, don't add it as the main key
        if (['control', 'shift', 'alt', 'meta'].includes(key)) {
            // Optional: we could support just "Ctrl" as a shortcut if we wanted
        } else {
            keys.push(key);
        }

        const pattern = keys.join('+');
        const actions = registry.get(pattern);

        if (actions && actions.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            // Trigger all callbacks tied to this shortcut
            actions.forEach(cb => cb.action(e));
        }
    };

    onMounted(() => {
        window.addEventListener('keydown', handleKeydown);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeydown);
    });
}

/**
 * Retrieves the currently registered keyboard shortcuts
 * useful to render dynamically in a Keyboard Map / Shortcut Modal interface.
 */
export function getShortcutsRegistry(): ShortcutMeta[] {
    const items: ShortcutMeta[] = [];
    registry.forEach(lists => {
        items.push(...lists);
    });
    return items;
}

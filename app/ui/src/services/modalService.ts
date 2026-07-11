import { ref } from 'vue';

export const confirmModal = ref<{
    title: string,
    message: string,
    danger?: boolean,
    onConfirm: () => void
} | null>(null);

export const inputModal = ref<{
    title: string,
    message: string,
    placeholder?: string,
    initialValue?: string,
    confirmText?: string,
    onConfirm: (val: string) => void
} | null>(null);

/** Stash dialog state: pick a message + mode, applied to `fileCount` selected files. */
export interface StashMode { keepIndex: boolean; includeUntracked: boolean; }
export const stashModal = ref<{
    fileCount: number,
    onConfirm: (message: string, mode: StashMode) => void
} | null>(null);

export function requestStash(fileCount: number, onConfirm: (message: string, mode: StashMode) => void) {
    stashModal.value = { fileCount, onConfirm };
}

/**
 * Position and items for a context menu.
 */
export const contextMenu = ref<{
    /** X coordinate in pixels. */
    x: number,
    /** Y coordinate in pixels. */
    y: number,
    /** List of menu items to render. */
    items: any[]
} | null>(null);

export const deviceFlowModal = ref<{
    userCode: string;
    verificationUri: string;
    onCancel: () => void;
} | null>(null);

export const isSettingsOpen = ref(false);
export const isShortcutsModalOpen = ref(false);
export const isCreatePROpen = ref(false);
export const isPushModalOpen = ref(false);
/** Non-fast-forward pull: ask the user to integrate via merge or rebase. */
export const isPullModalOpen = ref(false);
export const isAddSubmoduleOpen = ref(false);
export const isEditSubmoduleOpen = ref(false);
export const activeSubmodule = ref<any>(null);
export const isPullRequestDetailOpen = ref(false);
export const activePullRequest = ref<any>(null);
export const settingsActiveSection = ref('general');

export const branchActionModal = ref<{
    type: 'checkout_conflict' | 'create_branch' | 'checkout_index_conflict';
    targetBranch?: string;
    hasChanges?: boolean;
    /** For 'checkout_index_conflict': the in-progress op label (merge/rebase/…). */
    operation?: string;
    onConfirm: (action: 'stash' | 'discard' | 'keep' | 'abort', newBranchName?: string) => void;
} | null>(null);

/**
 * Requests a simple confirmation modal.
 * 
 * @param title - Modal title.
 * @param message - Detailed message.
 * @param danger - If true, highlights the confirm button as destructive.
 * @param action - Callback to execute if confirmed.
 */
export function requestConfirm(title: string, message: string, danger: boolean, action: () => void) {
    confirmModal.value = {
        title, message, danger, onConfirm: () => {
            action();
            confirmModal.value = null;
        }
    };
}

export function requestInput(title: string, message: string, placeholder: string, initialValue: string, confirmText: string, action: (val: string) => void) {
    inputModal.value = {
        title, message, placeholder, initialValue, confirmText, onConfirm: (val: string) => {
            action(val);
            inputModal.value = null;
        }
    };
}

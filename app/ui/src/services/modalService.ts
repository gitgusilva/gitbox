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

export const contextMenu = ref<{
    x: number,
    y: number,
    items: any[]
} | null>(null);

export const isSettingsOpen = ref(false);
export const isShortcutsModalOpen = ref(false);

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

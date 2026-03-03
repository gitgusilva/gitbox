import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: number;
    title: string;
    message: string;
    type: ToastType;
    link?: string;
    duration?: number;
}

export const toasts = ref<Toast[]>([]);
let toastIdCount = 0;

export function showToast(title: string, message: string, type: ToastType = 'info', options?: { duration?: number, link?: string }) {
    const id = ++toastIdCount;
    const toast: Toast = { id, title, message, type, ...options };
    toasts.value.push(toast);

    if (toast.duration !== 0) {
        setTimeout(() => removeToast(id), toast.duration || 5000);
    }
}

export function removeToast(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id);
}

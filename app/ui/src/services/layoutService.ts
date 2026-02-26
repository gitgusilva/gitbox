import { ref } from 'vue';
import {
    openRepo as gitOpenRepo,
    doFetch as gitFetch,
    doPull as gitPull,
    doPush as gitPush,
    discardAll as gitDiscardAll
} from './gitService';

export const sidebarWidth = ref(256);
export const detailsWidth = ref(340);
export const statusWidth = ref(300);
export const unstagedHeight = ref(300);
export const historyAuthorWidth = ref(120);
export const historyDateWidth = ref(100);

let isResizing = ref<string | null>(null);
let startY = 0;
let startHeight = 0;

let rafId: number | null = null;

export function onMouseMove(e: MouseEvent) {
    if (!isResizing.value) return;

    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
        if (isResizing.value === 'sidebar') sidebarWidth.value = Math.max(150, Math.min(800, e.clientX));
        else if (isResizing.value === 'details') detailsWidth.value = Math.max(200, Math.min(800, document.body.clientWidth - e.clientX));
        else if (isResizing.value === 'status') statusWidth.value = Math.max(150, Math.min(800, e.clientX - sidebarWidth.value));
        else if (isResizing.value === 'unstaged') unstagedHeight.value = Math.max(100, startHeight + (e.clientY - startY));
        else if (isResizing.value === 'historyAuthor') historyAuthorWidth.value = Math.max(80, startHeight - (e.clientX - startY));
        else if (isResizing.value === 'historyDate') historyDateWidth.value = Math.max(80, startHeight - (e.clientX - startY));
    });
}

export function onMouseUp() {
    isResizing.value = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

export function startResize(panel: string, e?: MouseEvent) {
    isResizing.value = panel;
    if (e) {
        startY = panel.startsWith('history') || panel === 'status' || panel === 'sidebar' ? e.clientX : e.clientY;
        startHeight = panel === 'unstaged' ? unstagedHeight.value :
            panel === 'historyAuthor' ? historyAuthorWidth.value :
                panel === 'historyDate' ? historyDateWidth.value : 0;
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Re-export git actions for layout convenience
export const openRepo = gitOpenRepo;
export const doFetch = gitFetch;
export const doPull = gitPull;
export const doPush = gitPush;
export const discardAll = gitDiscardAll;

import { Ref, ref } from 'vue';
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
export const stashFilesHeight = ref(300);
export const historyAuthorWidth = ref(120);
export const historyDateWidth = ref(100);
export const historyDetailTreeWidth = ref(240);
export const historyDetailInfoHeight = ref(400);
export const terminalHeight = ref(200);
export const terminalListWidth = ref(200);
export const blameWidth = ref(300);
export const submoduleDetailHeight = ref(400);

// For template usage without auto-unwrapping
export const layoutRefs = {
    sidebarWidth,
    detailsWidth,
    statusWidth,
    unstagedHeight,
    stashFilesHeight,
    historyAuthorWidth,
    historyDateWidth,
    historyDetailTreeWidth,
    historyDetailInfoHeight,
    terminalHeight,
    terminalListWidth,
    blameWidth,
    submoduleDetailHeight
};

export const isResizing = ref(false);
let activeRef: Ref<number> | null = null;
let startX = 0;
let startY = 0;
let startValue = 0;
let resizeAxis: 'x' | 'y' = 'x';
let resizeInvert = false;
let resizeMin = 0;
let resizeMax = 2000;
let resizeContainerMax = Infinity;
let currentOptions: ResizeOptions = {};
let targetCssVar: string | null = null;

let rafId: number | null = null;

export function onMouseMove(e: MouseEvent) {
    if (!isResizing.value || !activeRef) return;

    const ref = activeRef;
    if (!ref) return;

    rafId = requestAnimationFrame(() => {
        if (!isResizing.value) return;

        const clientX = Math.max(0, Math.min(window.innerWidth, e.clientX));
        const clientY = Math.max(0, Math.min(window.innerHeight, e.clientY));

        const delta = resizeAxis === 'x' ? (clientX - startX) : (clientY - startY);
        let newValue = resizeInvert ? (startValue - delta) : (startValue + delta);

        const windowSize = resizeAxis === 'x' ? window.innerWidth : window.innerHeight;
        // Room available in the direction the pane grows. For a normal (top/left)
        // pane that's the space toward the far edge; for an inverted (bottom/right)
        // pane — like the terminal, which grows upward — it's the space behind the
        // grab point. Must use the axis-matching start coord (startY on the y-axis),
        // not startX unconditionally, or vertical panes get a bogus height cap.
        const startPos = resizeAxis === 'x' ? startX : startY;
        const room = resizeInvert ? (startPos - 60) : (windowSize - startPos - 60);
        // resizeContainerMax caps a panel to the space its flex row actually has,
        // so it can fill AT MOST the available area instead of growing past the
        // window edge and shoving the rest of the layout off-screen.
        const maxLimit = Math.min(resizeMax, windowSize - 60, startValue + room, resizeContainerMax);

        const finalValue = Math.max(resizeMin, Math.min(maxLimit, newValue));

        if (targetCssVar) {
            document.documentElement.style.setProperty(targetCssVar, `${finalValue}px`);
        } else {
            ref.value = finalValue;
        }

        if (currentOptions.onResize) {
            currentOptions.onResize(finalValue);
        }
    });
}

export function onMouseUp(e: MouseEvent) {
    if (activeRef && targetCssVar) {
        const valueStr = document.documentElement.style.getPropertyValue(targetCssVar);
        if (valueStr) {
            activeRef.value = parseInt(valueStr);
            document.documentElement.style.removeProperty(targetCssVar);
        }
    }
    isResizing.value = false;
    activeRef = null;
    targetCssVar = null;
    currentOptions = {};
    document.body.classList.remove('resizing', 'resizing-row');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
}

export interface ResizeOptions {
    axis?: 'x' | 'y';
    invert?: boolean;
    min?: number;
    max?: number;
    cssVar?: string;
    onResize?: (value: number) => void;
    /** Clamp the panel so it never exceeds its flex-row container (minus a
     *  reserve for the sibling panel). Prevents dragging a panel past the
     *  window edge. */
    clampToContainer?: boolean;
    /** Space to leave for the sibling panel(s) when clampToContainer is on. */
    reserve?: number;
}

export function startResize(targetRef: Ref<number>, e: MouseEvent, options: ResizeOptions = {}) {
    isResizing.value = true;
    activeRef = targetRef;
    startX = e.clientX;
    startY = e.clientY;
    startValue = targetRef.value;
    currentOptions = options;
    resizeAxis = options.axis || 'x';
    resizeInvert = options.invert || false;
    resizeMin = options.min ?? 0;
    resizeMax = options.max ?? 2000;
    targetCssVar = options.cssVar || null;

    // Cap to the panel's flex-row container so it can't be dragged off-screen.
    resizeContainerMax = Infinity;
    if (options.clampToContainer) {
        const el = e.currentTarget as HTMLElement | null;
        // Resizer is absolutely positioned inside its panel; the panel's parent
        // is the flex row it shares with the sibling panel(s).
        const panel = (el && el.offsetParent) as HTMLElement | null;
        const container = panel ? panel.parentElement : null;
        if (container) {
            const extent = resizeAxis === 'y' ? container.clientHeight : container.clientWidth;
            const reserve = options.reserve ?? 140;
            const cm = extent - reserve;
            if (Number.isFinite(cm) && cm > resizeMin) resizeContainerMax = cm;
        }
    }

    if (targetCssVar) {
        document.documentElement.style.setProperty(targetCssVar, `${startValue}px`);
    }

    if (resizeAxis === 'y') {
        document.body.classList.add('resizing-row');
    } else {
        document.body.classList.add('resizing');
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

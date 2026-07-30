import { Ref, ref, watch } from 'vue';
import { getItem, setItem } from './storageService';
import {
    openRepo as gitOpenRepo,
    doFetch as gitFetch,
    doPull as gitPull,
    doPush as gitPush,
    discardAll as gitDiscardAll
} from './gitService';

/**
 * A pane size the user dragged, remembered across restarts.
 *
 * Writes are debounced because a drag updates the ref once per frame and the
 * store is a SYNCHRONOUS IPC round-trip — persisting every frame would stutter
 * the drag. Stored values are clamped on read so a size saved on a much bigger
 * screen (or a corrupted entry) can't push a pane off the window on next start.
 */
const LAYOUT_KEY = 'gitbox_layout_';
const pendingWrites = new Map<string, any>();

function persistedSize(key: string, fallback: number, min = 60, max = 2000): Ref<number> {
    let initial = fallback;
    const saved = Number(getItem(LAYOUT_KEY + key));
    if (Number.isFinite(saved) && saved > 0) {
        initial = Math.min(max, Math.max(min, saved));
    }

    const size = ref(initial);
    watch(size, (v) => {
        clearTimeout(pendingWrites.get(key));
        pendingWrites.set(key, setTimeout(() => {
            pendingWrites.delete(key);
            setItem(LAYOUT_KEY + key, String(Math.round(v)));
        }, 400));
    });
    return size;
}

export type DetailsOrientation = 'right' | 'bottom';

function persistedString<T extends string>(key: string, fallback: T, allowed: readonly T[]): Ref<T> {
    const saved = getItem(LAYOUT_KEY + key);
    const initial = (allowed.includes(saved as T) ? saved : fallback) as T;
    const value = ref(initial) as Ref<T>;
    watch(value, (v) => {
        setItem(LAYOUT_KEY + key, v);
    });
    return value;
}

export const sidebarWidth = persistedSize('sidebarWidth', 256, 160);
export const detailsWidth = persistedSize('detailsWidth', 340, 200);
export const detailsHeight = persistedSize('detailsHeight', 320, 160);
export const detailsOrientation = persistedString<DetailsOrientation>(
    'detailsOrientation',
    'right',
    ['right', 'bottom'] as const,
);
export const statusWidth = persistedSize('statusWidth', 300, 160);
export const unstagedHeight = persistedSize('unstagedHeight', 300, 100);
export const stashFilesHeight = persistedSize('stashFilesHeight', 300, 100);
export const stashPanelWidth = persistedSize('stashPanelWidth', 480, 200);
export const historyAuthorWidth = persistedSize('historyAuthorWidth', 120, 60, 1000);
export const historyDateWidth = persistedSize('historyDateWidth', 100, 60, 1000);
export const historyDetailTreeWidth = persistedSize('historyDetailTreeWidth', 240, 120);
export const historyDetailInfoHeight = persistedSize('historyDetailInfoHeight', 400, 100);
export const terminalHeight = persistedSize('terminalHeight', 200, 100, 1200);
export const terminalListWidth = persistedSize('terminalListWidth', 200, 100, 600);
export const blameWidth = persistedSize('blameWidth', 300, 120);
export const submoduleDetailHeight = persistedSize('submoduleDetailHeight', 400, 100);

// For template usage without auto-unwrapping
export const layoutRefs = {
    sidebarWidth,
    detailsWidth,
    detailsHeight,
    detailsOrientation,
    statusWidth,
    unstagedHeight,
    stashFilesHeight,
    stashPanelWidth,
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

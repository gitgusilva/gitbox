import { ref } from 'vue';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { isTerminalOpen } from './gitService';

export interface TermInstance {
    id: number;
    name: string;
    term: Terminal | null;
    fitAddon: FitAddon | null;
}

/**
 * Terminal state lives at module scope (not inside TerminalPanel) so the running
 * shells and their scrollback survive the panel unmounting — switching to the
 * Welcome/Changelog screen, closing the last workspace, etc. On remount the panel
 * re-attaches each xterm's existing DOM node to the fresh container.
 */
export const terminals = ref<TermInstance[]>([]);
export const activeTerminalId = ref<number | null>(null);

export function activeTerminal(): TermInstance | undefined {
    return terminals.value.find(t => t.id === activeTerminalId.value);
}

/**
 * Smallest container a fit may run against.
 *
 * The fit addon measures the xterm's parent. While that parent is hidden
 * (`v-show`), collapsed, or the window is minimized, it measures `auto`/0 and the
 * addon proposes xterm's 2x2 MINIMUM grid. Resizing to it reflows the whole
 * scrollback into 2-column lines, which blows past the scrollback limit and
 * DISCARDS the overflow — the terminal comes back empty (and the PTY gets told
 * it is 2 columns wide, mangling the shell's own redraw). So: never fit unless
 * the container is really laid out.
 */
const MIN_FIT_WIDTH = 120;
const MIN_FIT_HEIGHT = 60;
const MIN_COLS = 10;
const MIN_ROWS = 3;

/** The element the fit addon measures (xterm's own container). */
function hostOf(inst: TermInstance): HTMLElement | null {
    const parent = inst.term?.element?.parentElement ?? null;
    return parent && parent.isConnected ? parent : null;
}

/**
 * Resize a terminal to its container — but only when that is a real measurement.
 * Returns true when the grid was (re)applied.
 */
export function fitTerminal(inst: TermInstance | null | undefined): boolean {
    if (!inst || !inst.term || !inst.fitAddon) return false;

    const host = hostOf(inst);
    if (!host) return false;

    const rect = host.getBoundingClientRect();
    if (rect.width < MIN_FIT_WIDTH || rect.height < MIN_FIT_HEIGHT) return false;

    const dims = inst.fitAddon.proposeDimensions();
    if (!dims || !Number.isFinite(dims.cols) || !Number.isFinite(dims.rows)) return false;
    if (dims.cols < MIN_COLS || dims.rows < MIN_ROWS) return false;

    if (dims.cols === inst.term.cols && dims.rows === inst.term.rows) {
        // Same grid — but a resize to the current size is also how xterm re-measures
        // a char size that was taken while the panel was hidden, so still call it.
        inst.term.resize(dims.cols, dims.rows);
        return true;
    }

    inst.term.resize(dims.cols, dims.rows);
    window.gitbox.resizeTerminal(inst.id, dims.cols, dims.rows);
    return true;
}

/**
 * Bring a terminal back on screen: refit, then repaint. Rows drawn while the
 * panel was hidden were measured against a zero-size element, so without the
 * refresh the terminal can reappear blank even though the buffer is intact.
 */
export function revealTerminal(inst: TermInstance | null | undefined) {
    if (!inst || !inst.term) return;
    if (!hostOf(inst)) return;
    fitTerminal(inst);
    inst.term.refresh(0, inst.term.rows - 1);
}

/** Dispose a terminal (its PTY already exited or the user closed it). */
export function cleanupTerminal(id: number) {
    const idx = terminals.value.findIndex(t => t.id === id);
    if (idx < 0) return;
    const inst = terminals.value[idx];
    inst.term?.dispose();
    terminals.value.splice(idx, 1);

    if (activeTerminalId.value === id) {
        if (terminals.value.length > 0) {
            activeTerminalId.value = terminals.value[terminals.value.length - 1].id;
        } else {
            activeTerminalId.value = null;
            isTerminalOpen.value = false;
        }
    }
}

// Bound once for the lifetime of the app so PTY output keeps flowing into the
// xterm buffers even while the panel is unmounted (and never double-registers).
let listenersBound = false;
export function bindTerminalListeners() {
    if (listenersBound) return;
    listenersBound = true;
    const g = (window as any).gitbox;
    g.onTerminalData((id: number, data: string) => {
        const inst = terminals.value.find(t => t.id === id);
        inst?.term?.write(data);
    });
    g.onTerminalExit((id: number) => cleanupTerminal(id));
}

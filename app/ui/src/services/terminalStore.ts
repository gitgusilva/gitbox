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

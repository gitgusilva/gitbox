<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { repoPath, isTerminalOpen, toggleTerminal } from '../services/gitService';
import { Icon } from '@iconify/vue';
import Resizer from '../components/Common/Resizer.vue';
import Tooltip from '../components/Common/Tooltip.vue';
import ScrollArea from '../components/Common/ScrollArea.vue';
import { terminalHeight, terminalListWidth, layoutRefs } from '../services/layoutService';
import { terminals, activeTerminalId, bindTerminalListeners, cleanupTerminal } from '../services/terminalStore';
import '@xterm/xterm/css/xterm.css';

const { t } = useI18n();

const panelEl = ref<HTMLElement | null>(null);

let resizeObserver: ResizeObserver | null = null;

const isMaximized = ref(false);

const fitActiveTerminal = () => {
    if (!isTerminalOpen.value) return;
    const inst = terminals.value.find(t => t.id === activeTerminalId.value);
    if (inst && inst.fitAddon && inst.term) {
        inst.fitAddon.fit();
        window.gitbox.resizeTerminal(inst.id, inst.term.cols, inst.term.rows);
    }
};

// Coalesce refits to one per frame so dragging the resizer (which fires many
// height updates) doesn't thrash the fit addon.
let fitRaf = 0;
const scheduleFit = () => {
    if (fitRaf) return;
    fitRaf = requestAnimationFrame(() => { fitRaf = 0; fitActiveTerminal(); });
};

const addTerminal = async () => {
    if (!repoPath.value) return;

    const termId = await window.gitbox.spawnTerminal(repoPath.value);
    
    // Derive the terminal palette from the active theme tokens so it matches the
    // rest of the app (and recolors when the user picks another theme + reopens).
    const cs = getComputedStyle(document.documentElement);
    const tok = (name: string, fallback: string) => {
        const v = cs.getPropertyValue(name).trim();
        return v ? `rgb(${v.replace(/\s+/g, ', ')})` : fallback;
    };

    // Create xterm instance
    const term = new Terminal({
        fontFamily: '"Fira Code", monospace, "Courier New", Courier',
        fontSize: 12,
        theme: {
            background: tok('--gb-bg', '#1E1E1E'),
            foreground: tok('--gb-text', '#D4D4D4'),
            cursor: tok('--gb-accent', '#FFFFFF'),
            selectionBackground: tok('--gb-surface-hover', '#5c5c5c'),
        },
        cursorBlink: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.attachCustomKeyEventHandler((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
            if (e.type === 'keydown') {
                e.preventDefault();
                toggleTerminal();
            }
            return false;
        }
        return true;
    });

    term.onData(data => {
        window.gitbox.writeTerminal(termId, data);
    });

    terminals.value.push({
        id: termId,
        name: `bash-${termId}`,
        term,
        fitAddon
    });
    
    activeTerminalId.value = termId;

    await nextTick();
    fitActiveTerminal();
    term.focus();
};

const removeTerminal = (id: number) => {
    window.gitbox.killTerminal(id);
};

const setTerminalRef = (el: any, id: number) => {
    if (!el) return;
    const inst = terminals.value.find(t => t.id === id);
    if (!inst || !inst.term) return;
    if (!inst.term.element) {
        // First mount: create the xterm DOM inside this container.
        inst.term.open(el);
    } else if (inst.term.element.parentElement !== el) {
        // Remounted: the old container was destroyed — re-attach the existing
        // xterm DOM (with its scrollback intact) to the fresh container.
        el.appendChild(inst.term.element);
    }
    inst.fitAddon?.fit();
};

watch(repoPath, async (newPath) => {
    if (newPath && terminals.value.length === 0 && isTerminalOpen.value) {
        await addTerminal();
    }
});

watch(isTerminalOpen, async (isOpen) => {
    if (isOpen) {
        if (terminals.value.length === 0) {
            await addTerminal();
        }
        await nextTick();
        fitActiveTerminal();
        const inst = terminals.value.find(t => t.id === activeTerminalId.value);
        if (inst && inst.term) inst.term.focus();
    }
});

// Refit whenever the panel is maximized/restored or resized via the drag
// handles. terminalHeight updates continuously while dragging, so this keeps
// the xterm grid filling the panel instead of staying at its old small size.
watch([isMaximized, terminalHeight, terminalListWidth], () => {
    scheduleFit();
});

// Switching terminal tabs re-shows a v-show-hidden xterm whose grid measured
// against a 0-size element; refit it once it's visible so it reflows correctly.
watch(activeTerminalId, () => {
    nextTick(() => fitActiveTerminal());
});

// Maximizing swaps the panel to `absolute inset-0`; the grid must be recomputed
// only after that layout settles, otherwise the terminal keeps its old (small)
// row count and its content spills past the visible panel. Refit across a few
// frames to catch the final size.
watch(isMaximized, () => {
    nextTick(() => {
        fitActiveTerminal();
        requestAnimationFrame(() => fitActiveTerminal());
        setTimeout(() => fitActiveTerminal(), 60);
    });
});

onMounted(() => {
    // Data/exit listeners live in the store (bound once) so PTY output keeps
    // filling the xterm buffers even while this panel is unmounted.
    bindTerminalListeners();

    // Observe the panel itself (not <body>): its height changes on drag/maximize
    // while the body stays the same size, so a body observer never fired.
    resizeObserver = new ResizeObserver(() => {
        scheduleFit();
    });
    setTimeout(() => {
        if (panelEl.value) resizeObserver?.observe(panelEl.value);
    }, 100);
});

onUnmounted(() => {
    // Do NOT kill the terminals here — the store keeps them alive so the running
    // shells + scrollback survive a remount (re-attached in setTerminalRef).
    resizeObserver?.disconnect();
});

const handleTerminalResize = () => {
    isMaximized.value = false;
    fitActiveTerminal();
};
</script>

<template>
    <!-- Persistent bottom panel (VSCode-style). Rendered inline at the bottom of the
         main content area; when maximized it becomes absolute inset-0 to fill that
         whole area (over the tab views, but not the sidebar/toolbar/footer). -->
    <div ref="panelEl" v-show="isTerminalOpen" class="bg-app flex flex-col relative transition-none"
         :style="isMaximized ? {} : { height: terminalHeight + 'px' }"
         :class="isMaximized ? 'absolute inset-0 z-40' : 'flex-shrink-0 border-t border-line'">
             
            <!-- Resize Handle (Top) -->
            <Resizer vertical v-if="!isMaximized" 
                     :target="layoutRefs.terminalHeight" 
                     :options="{ axis: 'y', invert: true, min: 100, max: 1200 }" 
                     class="absolute top-0 left-0 right-0 h-1.5 z-40" 
                     @resize="handleTerminalResize" />
            
            <!-- Header -->
            <div class="h-9 bg-app border-b border-line flex items-center justify-between pr-2 select-none flex-shrink-0 rounded-t" :class="isMaximized ? 'rounded-none' : ''">
                <div class="flex items-center h-full overflow-hidden">
                    <div class="flex items-center gap-2 text-content-muted text-xs font-medium uppercase tracking-widest px-4 h-full">
                        <Icon icon="lucide:terminal" class="text-xs" />
                        {{ t('view.terminal') }}
                    </div>
                </div>
                
                <!-- Controls -->
                <div class="flex items-center gap-1">
                    <Tooltip :text="t('view.new_terminal')">
                        <button @click="addTerminal" class="text-content-muted hover:text-neutral-900 dark:hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-600">
                            <Icon icon="lucide:plus" class="text-sm" />
                        </button>
                    </Tooltip>
                    <div class="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-1"></div>
                    <Tooltip :text="isMaximized ? t('view.restore_panel') : t('view.maximize_panel')">
                        <button @click="isMaximized = !isMaximized" class="text-content-muted hover:text-neutral-900 dark:hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-600">
                            <Icon :icon="isMaximized ? 'lucide:minimize-2' : 'lucide:maximize-2'" class="text-xs" />
                        </button>
                    </Tooltip>
                    <Tooltip :text="t('view.close_panel')">
                        <button @click="toggleTerminal" class="text-content-muted hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded hover:bg-red-500">
                            <Icon icon="lucide:x" class="text-sm" />
                        </button>
                    </Tooltip>
                </div>
            </div>
            
            <!-- Terminal Container Area -->
            <div class="flex-1 w-full relative min-h-0 bg-app flex">
                <!-- Main Output -->
                <div class="flex-1 relative min-w-0 py-1">
                    <div v-for="t in terminals" :key="t.id" v-show="activeTerminalId === t.id" class="absolute inset-0 px-2 pb-1 overflow-hidden outline-none">
                        <div :ref="el => setTerminalRef(el, t.id)" class="w-full h-full"></div>
                    </div>
                </div>
                
                <!-- Resize Handle (List) -->
                <Resizer :target="layoutRefs.terminalListWidth"
                         :options="{ invert: true, min: 100, max: 600, clampToContainer: true, reserve: 200 }"
                         class="z-40 flex-shrink-0"
                         @resize="fitActiveTerminal" />
                
                <!-- Sessions List -->
                <ScrollArea class="bg-app border-l border-line flex flex-shrink-0 min-h-0" :style="{ width: terminalListWidth + 'px', height: '100%' }">
                    <div class="flex flex-col flex-shrink-0">
                        <div v-for="t in terminals" :key="t.id"
                             @click="activeTerminalId = t.id; fitActiveTerminal()"
                             class="h-8 px-3 flex items-center gap-2 cursor-pointer transition-colors group relative"
                             :class="activeTerminalId === t.id ? 'bg-surface text-accent' : 'text-neutral-500 hover:bg-neutral-200 dark:hover:bg-[#2A2A2B] hover:text-neutral-700 dark:hover:text-neutral-300'">
                             <Icon icon="lucide:terminal-square" class="w-3.5 h-3.5 flex-shrink-0" />
                             <span class="text-xs flex-1 truncate">{{ t.name }}</span>
                             <Icon icon="lucide:trash-2" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity flex-shrink-0" @click.stop="removeTerminal(t.id)" />
                             <div v-if="activeTerminalId === t.id" class="absolute left-0 inset-y-0 w-[3px] bg-accent"></div>
                        </div>
                    </div>
                </ScrollArea>
            </div>
        </div>
</template>

<style scoped>
/* overrides for terminal */
:deep(.xterm-viewport) {
    border-radius: 4px;
}
:deep(.xterm .xterm-scroll-area) {
    scrollbar-width: thin;
    scrollbar-color: #424242 transparent;
}
:deep(.xterm .xterm-scroll-area::-webkit-scrollbar) {
    width: 10px;
}
:deep(.xterm .xterm-scroll-area::-webkit-scrollbar-track) {
    background: transparent;
}
:deep(.xterm .xterm-scroll-area::-webkit-scrollbar-thumb) {
    background: #424242;
    border: 3px solid #1E1E1E; /* matches background */
    border-radius: 5px;
}
:deep(.xterm .xterm-scroll-area::-webkit-scrollbar-thumb:hover) {
    background: #5c5c5c;
}
</style>

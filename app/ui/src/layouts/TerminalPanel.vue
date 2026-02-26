<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, shallowRef, computed } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { repoPath, isTerminalOpen, toggleTerminal, activeTab } from '../services/gitService';
import { Icon } from '@iconify/vue';
import SimpleBar from 'simplebar-vue';
import '@xterm/xterm/css/xterm.css';

interface TermInstance {
    id: number;
    name: string;
    term: Terminal | null;
    fitAddon: FitAddon | null;
}

const terminals = ref<TermInstance[]>([]);
const activeTerminalId = ref<number | null>(null);

let resizeObserver: ResizeObserver | null = null;

const panelHeight = ref(256);
const listWidth = ref(180);
const isResizing = ref(false);
const isListResizing = ref(false);
const isMaximized = ref(false);

const teleportTarget = computed(() => {
    if (isMaximized.value) return 'body';
    // If we're on a supported tab, teleport there, else fallback to a container or just don't render
    const t = activeTab.value;
    if (t === 'history' || t === 'local_changes' || t === 'stashes') {
        return `#terminal-target-${t}`;
    }
    return null;
});

const isTeleportReady = ref(false);

const startResize = (e: MouseEvent) => {
    isResizing.value = true;
    isMaximized.value = false;
    const startY = e.clientY;
    const startHeight = panelHeight.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.value) return;
        const delta = startY - moveEvent.clientY;
        panelHeight.value = Math.max(100, Math.min(1200, startHeight + delta));
    };

    const onMouseUp = () => {
        isResizing.value = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        fitActiveTerminal();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
};

const startListResize = (e: MouseEvent) => {
    isListResizing.value = true;
    const startX = e.clientX;
    const startWidth = listWidth.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isListResizing.value) return;
        const delta = startX - moveEvent.clientX; 
        listWidth.value = Math.max(100, Math.min(600, startWidth + delta));
    };

    const onMouseUp = () => {
        isListResizing.value = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        fitActiveTerminal();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
};

const fitActiveTerminal = () => {
    if (!isTerminalOpen.value) return;
    const inst = terminals.value.find(t => t.id === activeTerminalId.value);
    if (inst && inst.fitAddon && inst.term) {
        inst.fitAddon.fit();
        window.gitbox.resizeTerminal(inst.id, inst.term.cols, inst.term.rows);
    }
};

const addTerminal = async () => {
    if (!repoPath.value) return;

    const termId = await window.gitbox.spawnTerminal(repoPath.value);
    
    // Create xterm instance
    const term = new Terminal({
        fontFamily: '"Fira Code", monospace, "Courier New", Courier',
        fontSize: 12,
        theme: {
            background: '#1E1E1E',
            foreground: '#D4D4D4',
            cursor: '#FFFFFF',
            selectionBackground: '#5c5c5c'
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

const cleanupTerminal = (id: number) => {
    const idx = terminals.value.findIndex(t => t.id === id);
    if (idx >= 0) {
        const inst = terminals.value[idx];
        inst.term?.dispose();
        terminals.value.splice(idx, 1);
        
        if (activeTerminalId.value === id) {
            if (terminals.value.length > 0) {
                activeTerminalId.value = terminals.value[terminals.value.length - 1].id;
                nextTick(() => { fitActiveTerminal(); });
            } else {
                activeTerminalId.value = null;
                isTerminalOpen.value = false;
            }
        }
    }
};

const setTerminalRef = (el: any, id: number) => {
    if (el) {
        const inst = terminals.value.find(t => t.id === id);
        if (inst && inst.term && !inst.term.element) {
            inst.term.open(el);
            inst.fitAddon?.fit();
        }
    }
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

watch(activeTab, async () => {
    isTeleportReady.value = false;
    await nextTick();
    // Wait for the new view to mount its target
    setTimeout(() => {
        isTeleportReady.value = true;
        nextTick(() => fitActiveTerminal());
    }, 100);
}, { immediate: true });

import { registerShortcut } from '../services/shortcutService';

onMounted(() => {
    window.gitbox.onTerminalData((id, data) => {
        const inst = terminals.value.find(t => t.id === id);
        if (inst && inst.term) {
            inst.term.write(data);
        }
    });

    window.gitbox.onTerminalExit((id) => {
        cleanupTerminal(id);
    });

    resizeObserver = new ResizeObserver(() => {
        fitActiveTerminal();
    });

    // Observe body or panel for resizes
    setTimeout(() => {
        if (document.body) resizeObserver?.observe(document.body);
    }, 100);
});

onUnmounted(() => {
    for (const t of terminals.value) {
        window.gitbox.killTerminal(t.id);
        t.term?.dispose();
    }
    resizeObserver?.disconnect();
});
</script>

<template>
    <Teleport :to="teleportTarget" v-if="teleportTarget && isTeleportReady" :disabled="isMaximized">
        <div v-show="isTerminalOpen" class="bg-[#1E1E1E] flex flex-col flex-shrink-0 relative transition-none"
             :style="isMaximized ? { top: '0', bottom: '0', left: '0', right: '0' } : { height: panelHeight + 'px' }"
             :class="isMaximized ? 'absolute z-[9999]' : 'border-t border-neutral-800'">
             
            <!-- Resize Handle (Top) -->
            <div v-if="!isMaximized" class="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize z-40 hover:bg-blue-500/50" @mousedown="startResize"></div>
            
            <!-- Header -->
            <div class="h-9 bg-[#18181A] border-b border-neutral-800 flex items-center justify-between pr-2 select-none flex-shrink-0 rounded-t" :class="isMaximized ? 'rounded-none' : ''">
                <div class="flex items-center h-full overflow-hidden">
                    <div class="flex items-center gap-2 text-neutral-400 text-xs font-medium uppercase tracking-widest px-4 h-full">
                        <Icon icon="lucide:terminal" class="text-xs" />
                        Terminal
                    </div>
                </div>
                
                <!-- Controls -->
                <div class="flex items-center gap-1">
                    <button @click="addTerminal" class="text-neutral-400 hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded hover:bg-neutral-600" title="New Terminal">
                        <Icon icon="lucide:plus" class="text-sm" />
                    </button>
                    <div class="w-px h-4 bg-neutral-700 mx-1"></div>
                    <button @click="isMaximized = !isMaximized" class="text-neutral-400 hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded hover:bg-neutral-600" title="Maximize Panel">
                        <Icon :icon="isMaximized ? 'lucide:minimize-2' : 'lucide:maximize-2'" class="text-xs" />
                    </button>
                    <button @click="toggleTerminal" class="text-neutral-400 hover:text-white transition-colors h-6 w-6 flex items-center justify-center rounded hover:bg-red-500" title="Close Panel">
                        <Icon icon="lucide:x" class="text-sm" />
                    </button>
                </div>
            </div>
            
            <!-- Terminal Container Area -->
            <div class="flex-1 w-full relative min-h-0 bg-[#1E1E1E] flex">
                <!-- Main Output -->
                <div class="flex-1 relative min-w-0 py-1">
                    <div v-for="t in terminals" :key="t.id" v-show="activeTerminalId === t.id" class="absolute inset-0 px-2 pb-1 overflow-hidden outline-none">
                        <div :ref="el => setTerminalRef(el, t.id)" class="w-full h-full"></div>
                    </div>
                </div>
                
                <!-- Resize Handle (List) -->
                <div class="w-1 cursor-col-resize hover:bg-blue-500/50 z-40 flex-shrink-0 transition-colors" @mousedown="startListResize"></div>
                
                <!-- Sessions List -->
                <SimpleBar class="bg-[#18181A] border-l border-neutral-800 flex flex-shrink-0 min-h-0" :style="{ width: listWidth + 'px', height: '100%' }">
                    <div class="flex flex-col flex-shrink-0">
                        <div v-for="t in terminals" :key="t.id"
                             @click="activeTerminalId = t.id; fitActiveTerminal()"
                             class="h-8 px-3 flex items-center gap-2 cursor-pointer transition-colors group relative"
                             :class="activeTerminalId === t.id ? 'bg-[#252526] text-blue-400' : 'text-neutral-500 hover:bg-[#2A2A2B] hover:text-neutral-300'">
                             <Icon icon="lucide:terminal-square" class="w-3.5 h-3.5 flex-shrink-0" />
                             <span class="text-xs flex-1 truncate">{{ t.name }}</span>
                             <Icon icon="lucide:trash-2" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity flex-shrink-0" @click.stop="removeTerminal(t.id)" />
                             <div v-if="activeTerminalId === t.id" class="absolute left-0 inset-y-0 w-[3px] bg-blue-500"></div>
                        </div>
                    </div>
                </SimpleBar>
            </div>
        </div>
    </Teleport>
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

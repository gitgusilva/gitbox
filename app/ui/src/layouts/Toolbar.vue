<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { 
  workspaces, 
  activeWorkspaceId, 
  setActiveWorkspace, 
  removeWorkspace, 
  addWorkspace,
  updateWorkspace
} from '../services/workspaceService';
import { repoPath, loadRepoData, isLoadingData } from '../services/gitService';
import { ref, watch, onMounted } from 'vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

const isOverflowing = ref(false);
let observer: ResizeObserver | null = null;

const tabsContainer = ref<any>(null);

function getScrollEl() {
    if (!tabsContainer.value) return null;
    return tabsContainer.value.scrollElement || 
           (tabsContainer.value.$el && tabsContainer.value.$el.querySelector('.simplebar-content-wrapper')) || 
           tabsContainer.value.$el;
}

function scrollTabsBy(amount: number) {
    const el = getScrollEl();
    if (el && el.scrollBy) {
        el.scrollBy({ left: amount, behavior: 'smooth' });
    }
}

function onTabScroll(e: WheelEvent) {
    const el = getScrollEl();
    if (el && e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
    }
}

const { t } = useI18n();
const isColorPickerOpen = ref(false);
const editingWorkspaceId = ref<string | null>(null);

const draggingId = ref<string | null>(null);

const colors = ['#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5', '#039BE5', '#00ACC1', '#00897B', '#43A047', '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00', '#F4511E'];

watch(activeWorkspaceId, (id) => {
  const ws = workspaces.value.find(w => w.id === id);
  if (ws) {
    repoPath.value = ws.path;
    loadRepoData(true);
  }
});

let checkOverflow: (() => void) | undefined;

watch(workspaces, () => {
    setTimeout(() => {
        if (checkOverflow) checkOverflow();
    }, 50);
}, { deep: true });

onMounted(() => {
    if (activeWorkspaceId.value) {
        const ws = workspaces.value.find(w => w.id === activeWorkspaceId.value);
        if (ws) {
            repoPath.value = ws.path;
            loadRepoData(true);
        }
    }

    checkOverflow = () => {
        const el = getScrollEl();
        if (el) {
            // Calculate total width of children to get actual scroll width instead of relying on container
            const children = Array.from(el.querySelectorAll('.h-8.max-w-\\[200px\\]')) as HTMLElement[];
            let totalWidth = 0;
            children.forEach(child => totalWidth += child.offsetWidth + 2); // 2px for margin
            totalWidth += 40; // Add space for '+' button itself
            isOverflowing.value = totalWidth > el.clientWidth;
        }
    };

    observer = new ResizeObserver(() => {
        if (checkOverflow) checkOverflow();
    });
    if (tabsContainer.value && tabsContainer.value.$el) {
        observer.observe(tabsContainer.value.$el);
        setTimeout(() => {
            const inner = tabsContainer.value.$el.querySelector('.simplebar-content');
            if (inner && observer) observer.observe(inner);
        }, 100);
    }
    setTimeout(() => { if (checkOverflow) checkOverflow(); }, 100);
});

import { addNewTab, addWorkspaceFlow } from '../services/workspaceService';
import { contextMenu, requestInput } from '../services/modalService';

async function handleAddWorkspaceFlow() {
  addNewTab();
}

function handleClose() {
    window.gitbox.close();
}

function handleMinimize() {
    window.gitbox.minimize();
}

function handleMaximize() {
    window.gitbox.maximize();
}

import { registerShortcut } from '../services/shortcutService';

onMounted(() => {
    registerShortcut('ctrl+t', () => handleAddWorkspaceFlow(), { descriptionKey: 'New Tab', category: 'global' });
    registerShortcut('ctrl+w', () => {
        if (activeWorkspaceId.value) removeWorkspace(activeWorkspaceId.value);
    }, { descriptionKey: 'Close Tab', category: 'global' });
    registerShortcut('ctrl+o', () => addWorkspaceFlow(), { descriptionKey: 'Open Repository', category: 'global' });
    registerShortcut('ctrl+q', () => handleClose(), { descriptionKey: 'Quit Application', category: 'global' });
});

function openColorPicker(wsId: string) {
    editingWorkspaceId.value = wsId;
    isColorPickerOpen.value = true;
}

function openTabMenu(e: MouseEvent, wsId: string) {
    contextMenu.value = {
        x: e.clientX,
        y: e.clientY,
        items: [
            {
                label: 'Close tab',
                icon: 'lucide:x',
                action: () => removeWorkspace(wsId)
            },
            {
                label: 'Close other tabs',
                action: () => {
                    workspaces.value = workspaces.value.filter(w => w.id === wsId);
                    if (activeWorkspaceId.value !== wsId) setActiveWorkspace(wsId);
                }
            },
            {
                label: 'Close tabs to the right',
                action: () => {
                    const idx = workspaces.value.findIndex(w => w.id === wsId);
                    if (idx >= 0) {
                        const idsToRemove = workspaces.value.slice(idx + 1).map(w => w.id);
                        workspaces.value = workspaces.value.slice(0, idx + 1);
                        if (idsToRemove.includes(activeWorkspaceId.value!)) {
                            setActiveWorkspace(wsId);
                        }
                    }
                }
            },
            { separator: true },
            {
                label: 'Alias repository',
                icon: 'lucide:edit-2',
                action: () => {
                    const ws = workspaces.value.find(w => w.id === wsId);
                    if (ws) {
                        requestInput('Alias Repository', 'Enter a new name for this tab:', 'Repository Name', ws.name, 'Save', (val) => {
                            if (val) updateWorkspace(wsId, { name: val });
                        });
                    }
                }
            },
            { separator: true },
            {
                label: 'Change color...',
                icon: 'lucide:palette',
                action: () => openColorPicker(wsId)
            }
        ]
    };
}

function openMainMenu(e: MouseEvent) {
    contextMenu.value = {
        x: e.clientX,
        y: e.clientY + 20,
        items: [
            { label: 'New Tab', shortcut: 'Ctrl+T', action: () => handleAddWorkspaceFlow() },
            { label: 'Close Tab', shortcut: 'Ctrl+W', action: () => {
                if (activeWorkspaceId.value) removeWorkspace(activeWorkspaceId.value);
            }},
            { label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T', action: () => {} },
            { separator: true },
            { label: 'Clone Repo...', shortcut: 'Ctrl+N', action: () => {} },
            { label: 'Init Repo...', shortcut: 'Ctrl+I', action: () => {} },
            { label: 'Open Repo...', shortcut: 'Ctrl+O', action: () => addWorkspaceFlow() },
            { label: 'Open Repo Management', shortcut: 'Alt+Ctrl+O', action: () => {} },
            { label: 'Open Repo in External Editor', shortcut: 'Ctrl+Shift+E', action: () => {} },
            { separator: true },
            { label: 'Open External Terminal', shortcut: 'Alt+T', action: () => {} },
            { label: 'Open in File Manager', shortcut: 'Alt+O', action: () => {} },
            { separator: true },
            { label: 'Preferences...', shortcut: 'Ctrl+,', action: () => {} },
            { separator: true },
            { label: 'Quit', shortcut: 'Ctrl+Q', action: () => handleClose() }
        ]
    };
}

function selectColor(color: string) {
    if (editingWorkspaceId.value) {
        updateWorkspace(editingWorkspaceId.value, { color });
    }
    isColorPickerOpen.value = false;
    editingWorkspaceId.value = null;
}

function onDragStart(e: DragEvent, id: string) {
    draggingId.value = id;
    if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
        const img = new Image();
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(img, 0, 0);
    }
}

let swapThrottle = false;

function onDragEnter(e: DragEvent, targetId: string) {
    if (!draggingId.value || draggingId.value === targetId || swapThrottle) return;
    
    const list = [...workspaces.value];
    const sourceIndex = list.findIndex(w => w.id === draggingId.value);
    const targetIndex = list.findIndex(w => w.id === targetId);
    
    if (sourceIndex >= 0 && targetIndex >= 0) {
        swapThrottle = true;
        const [item] = list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, item);
        workspaces.value = list;

        // Prevent immediate re-swaps while the transition is happening to stop flickering
        setTimeout(() => { swapThrottle = false; }, 200);
    }
}

function onDragEnd() {
    draggingId.value = null;
}

import { getItem, setItem } from '../services/storageService';

watch(activeWorkspaceId, async (val) => {
    if (!val) return;
    const ws = workspaces.value.find(w => w.id === val);
    if (!ws) return;
    
    // Update repo and load data
    repoPath.value = ws.path;
    setItem('gitbox_repo_path', ws.path);
    await loadRepoData();
    
    // Scroll tab into view
    setTimeout(() => {
        const el = document.getElementById(`workspace-tab-${val}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }, 50);
}, { immediate: true });
</script>

<template>
  <div class="flex-shrink-0 h-10 bg-[#202020] dark:bg-[#18181A] border-b border-light-border dark:border-[#2D2D2D] flex items-center shadow-sm select-none" style="-webkit-app-region: drag;">
    
    <!-- Left actions -->
    <div class="flex items-center px-4 gap-3 relative z-10" style="-webkit-app-region: no-drag;">
       <div class="p-1 hover:bg-[#2D2D2D] rounded cursor-pointer transition-colors flex items-center justify-center -ml-1 text-neutral-400 hover:text-white" @click="openMainMenu">
           <Icon icon="lucide:menu" />
       </div>
       <!-- Removed the folder from here entirely? Or leave it? User only complained about + button -> let's leave it as is. -->
       <div class="p-1 hover:bg-[#2D2D2D] rounded cursor-pointer transition-colors flex items-center justify-center text-neutral-400 hover:text-white" @click="handleAddWorkspaceFlow">
           <Icon icon="lucide:folder" />
       </div>
    </div>

    <!-- Tabs -->
    <div class="flex flex-1 min-w-0 h-full relative group/tabs mr-8" style="-webkit-app-region: drag;">
        <SimpleBar ref="tabsContainer" class="flex-1 min-w-0 h-full w-full custom-toolbar-sb" @wheel.prevent="onTabScroll">
            <TransitionGroup name="tab-drag" tag="div" class="flex h-full items-end pl-2 min-w-max">
                <!-- What's New special tab -->
                <div @click="activeWorkspaceId = 'changelog'"
                     style="-webkit-app-region: no-drag;"
                     class="h-8 min-w-[120px] px-3 flex items-center justify-between gap-2 rounded-t-md mx-[1px] cursor-pointer group transition-colors relative"
                     :class="activeWorkspaceId === 'changelog' ? 'bg-[#2D2D2D] text-white' : 'bg-[#1E1E1E] text-neutral-400 hover:bg-[#252525] hover:text-neutral-200'">
                     <div class="flex items-center gap-2 overflow-hidden flex-1">
                        <Icon icon="lucide:megaphone" class="w-3.5 h-3.5 text-blue-500" />
                        <span class="truncate text-xs font-medium">{{ t('common.whats_new') }}</span>
                     </div>
                     <Icon icon="lucide:x" @click.stop="activeWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null" class="opacity-0 group-hover:opacity-100 w-3 h-3 hover:text-red-400 transition-opacity flex-shrink-0 ml-2" />
                     <div v-if="activeWorkspaceId === 'changelog'" class="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-t"></div>
                </div>

                <div v-for="ws in workspaces" :key="ws.id" 
                     :id="`workspace-tab-${ws.id}`"
                     @click="setActiveWorkspace(ws.id)"
                     @contextmenu.prevent="openTabMenu($event, ws.id)"
                     draggable="true"
                     @dragstart="onDragStart($event, ws.id)"
                     @dragover.prevent
                     @dragenter.prevent="onDragEnter($event, ws.id)"
                     @dragend="onDragEnd"
                     style="-webkit-app-region: no-drag;"
                     class="h-8 max-w-[200px] min-w-[120px] px-3 flex items-center justify-between rounded-t-md mx-[1px] cursor-pointer group transition-colors relative border-b-2 border-transparent"
                     :class="activeWorkspaceId === ws.id ? 'bg-[#2D2D2D] text-white border-blue-500' : 'bg-[#1E1E1E] text-neutral-400 hover:bg-[#252525] hover:text-neutral-200'">
                     
                     <div class="flex items-center gap-2 overflow-hidden flex-1">
                         <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: ws.color }"></div>
                         <span class="truncate text-xs font-medium">{{ ws.name }}</span>
                     </div>
                     <div class="flex items-center justify-center w-4 h-4 ml-2">
                        <Icon v-if="isLoadingData && activeWorkspaceId === ws.id" icon="lucide:loader-2" class="w-3 h-3 text-blue-500 animate-spin" />
                        <Icon v-else icon="lucide:x" @click.stop="removeWorkspace(ws.id)" class="opacity-0 group-hover:opacity-100 w-3 h-3 hover:text-red-400 transition-opacity" />
                     </div>
                </div>

                <!-- Inline + button -->
                <div v-if="!isOverflowing" class="h-8 w-8 ml-1 mb-0 flex flex-shrink-0 items-center justify-center cursor-pointer hover:bg-[#2D2D2D] rounded-t-md text-neutral-400 hover:text-white transition-colors" @click="handleAddWorkspaceFlow" title="Add Workspace" style="-webkit-app-region: no-drag;">
                    <Icon icon="lucide:plus" class="w-4 h-4" />
                </div>
            </TransitionGroup>
        </SimpleBar>

        <!-- Right Controls (Arrows +) -->
        <div v-if="isOverflowing" class="flex items-center h-full px-1 bg-[#202020] dark:bg-[#18181A] z-20" style="-webkit-app-region: no-drag;">
             <div class="h-8 w-6 flex flex-shrink-0 items-center justify-center cursor-pointer hover:bg-[#2D2D2D] rounded text-neutral-400 hover:text-white" @click="scrollTabsBy(-200)">
                 <Icon icon="lucide:chevron-left" class="w-4 h-4" />
             </div>
             <div class="h-8 w-6 flex flex-shrink-0 items-center justify-center cursor-pointer hover:bg-[#2D2D2D] rounded text-neutral-400 hover:text-white" @click="scrollTabsBy(200)">
                 <Icon icon="lucide:chevron-right" class="w-4 h-4" />
             </div>
             <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center cursor-pointer hover:bg-[#2D2D2D] rounded text-neutral-400 hover:text-white ml-0.5" @click="handleAddWorkspaceFlow" title="Add Workspace">
                 <Icon icon="lucide:plus" class="w-4 h-4" />
             </div>
        </div>
    </div>

    <!-- Right Window Controls -->
    <div class="flex h-full" style="-webkit-app-region: no-drag;">
        <div class="w-12 h-full flex items-center justify-center text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer" @click="handleMinimize">
            <Icon icon="lucide:minus" class="w-4 h-4" />
        </div>
        <div class="w-12 h-full flex items-center justify-center text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer" @click="handleMaximize">
            <Icon icon="lucide:square" class="w-3.5 h-3.5" />
        </div>
        <div class="w-12 h-full flex items-center justify-center text-neutral-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer" @click="handleClose">
            <Icon icon="lucide:x" class="w-4 h-4" />
        </div>
    </div>

    <!-- Color Picker Modal -->
    <div v-if="isColorPickerOpen" class="absolute top-10 flex flex-wrap gap-2 w-48 p-3 bg-neutral-800 border border-neutral-700 rounded-md shadow-xl z-50" style="-webkit-app-region: no-drag;">
        <div v-for="c in colors" :key="c" @click="selectColor(c)" class="w-6 h-6 rounded cursor-pointer hover:scale-110 transition-transform" :style="{ backgroundColor: c }"></div>
    </div>
  </div>
</template>

<style scoped>
.tab-drag-move {
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.custom-toolbar-sb :deep(.simplebar-scrollbar::before) {
    background-color: rgba(255, 255, 255, 0.15);
    height: 4px;
    bottom: 0;
    top: auto;
    border-radius: 2px;
}

.custom-toolbar-sb :deep(.simplebar-wrapper),
.custom-toolbar-sb :deep(.simplebar-mask),
.custom-toolbar-sb :deep(.simplebar-offset),
.custom-toolbar-sb :deep(.simplebar-content-wrapper),
.custom-toolbar-sb :deep(.simplebar-content) {
    height: 100%;
}
</style>

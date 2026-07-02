<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { contextMenu } from '../services/modalService';
import { useI18n } from 'vue-i18n';
import ConfirmModal from '../components/ConfirmModal.vue';
import Tooltip from '../components/Common/Tooltip.vue';
import { getItem, setItem } from '../services/storageService';
import { activeTab } from '../services/gitService';
import { appVersion as version } from '../services/versionService';

const { t } = useI18n();

import { getShortcutsRegistry } from '../services/shortcutService';
import { isShortcutsModalOpen } from '../services/modalService';
import ScrollArea from '../components/Common/ScrollArea.vue';

const openShortcutsModal = () => {
    isShortcutsModalOpen.value = true;
};

const openSupport = async () => {
    if (window.gitbox && window.gitbox.openExternal) {
        await window.gitbox.openExternal('https://discord.gg/gitbox');
    }
};

const zoomLevel = ref(getItem('gitbox_zoom') || '100%');
onMounted(() => {
    if (zoomLevel.value !== '100%') {
        if (window.gitbox && window.gitbox.setZoom) {
            window.gitbox.setZoom(parseInt(zoomLevel.value) / 100);
        }
    }
});

const setZoom = (level: string) => {
    zoomLevel.value = level;
    setItem('gitbox_zoom', level);
    if (window.gitbox && window.gitbox.setZoom) {
        window.gitbox.setZoom(parseInt(level) / 100);
    }
};

const openZoomMenu = (e: MouseEvent) => {
    contextMenu.value = {
        x: e.clientX - 50,
        y: e.clientY - 175,
        items: [
            { label: '130%', action: () => setZoom('130%') },
            { label: '120%', action: () => setZoom('120%') },
            { label: '110%', action: () => setZoom('110%') },
            { label: '100%', action: () => setZoom('100%') },
            { label: '90%', action: () => setZoom('90%') },
            { label: '80%', action: () => setZoom('80%') }
        ]
    };
};
</script>

<template>
  <div class="h-[22px] bg-white dark:bg-[#1E1E1E] border-t border-neutral-300 dark:border-[#2D2D2D] flex items-center justify-between px-3 text-neutral-700 dark:text-[#CCCCCC] text-[11px] select-none flex-shrink-0 z-50">
    
    <!-- Left Side -->
    <div class="flex items-center h-full gap-3">
        <Tooltip :text="t('common.output_log')" position="top">
            <div 
              @click="activeTab = activeTab === 'output_log' ? 'history' : 'output_log'" 
              class="cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors h-full flex items-center px-2 gap-1.5 border-r border-neutral-300 dark:border-[#2D2D2D] pr-3"
              :class="{ 'text-blue-400 bg-blue-400/5': activeTab === 'output_log' }"
            >
                <Icon icon="lucide:terminal" class="w-3.5 h-3.5" />
                <span class="font-medium">{{ t('common.output_log') }}</span>
            </div>
        </Tooltip>
    </div>

    <!-- Right Side -->
    <div class="flex items-center h-full gap-3">
        <Tooltip :text="t('common.zoom_level')" position="top">
            <div @click="openZoomMenu" class="cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors h-full flex items-center px-1 gap-1">
                <Icon icon="lucide:zoom-in" class="w-3 h-3" />
                <span>{{ zoomLevel }}</span>
            </div>
        </Tooltip>
        <Tooltip :text="`${t('common.keyboard_shortcuts')} (Ctrl+/)`" position="top">
            <div @click="openShortcutsModal" class="cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors h-full flex items-center px-1 gap-1">
                <Icon icon="lucide:keyboard" class="w-3.5 h-3.5" />
            </div>
        </Tooltip>

        <div class="w-px h-3.5 bg-neutral-300 dark:bg-[#333333] hidden sm:block"></div>

        <div @click="openSupport" class="cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors h-full flex items-center px-1 text-blue-400">
            {{ t('common.support') }}
        </div>
        
        <Tooltip :text="t('common.version')" position="top">
            <div class="flex items-center gap-1.5 h-full px-1">
                <span class="text-neutral-500 font-mono tracking-tight">GITBOX v{{ version }}</span>
            </div>
        </Tooltip>
    </div>

    <!-- Shortcuts Modal -->
    <ConfirmModal v-if="isShortcutsModalOpen" :title="t('common.keyboard_shortcuts')" hide-buttons class="max-w-lg p-0 bg-white dark:bg-[#252526]" @cancel="isShortcutsModalOpen = false">
        <ScrollArea class="p-5 max-h-[60vh] bg-neutral-50 dark:bg-[#1E1E1E] rounded-b-xl relative">
            <div v-for="category in ['global', 'repository', 'terminal', 'editor', 'other']" :key="category">
                <template v-if="getShortcutsRegistry().filter(item => (item.category || 'other') === category).length > 0">
                    <div class="font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest text-[9px] mb-3 mt-4 first:mt-0 flex items-center gap-2">
                        <span>{{ category }}</span>
                        <div class="h-px bg-neutral-200 dark:bg-neutral-800 flex-1"></div>
                    </div>
                    <div class="flex flex-col gap-1.5 mb-6">
                        <div v-for="(item, idx) in getShortcutsRegistry().filter(item => (item.category || 'other') === category)" :key="idx" class="flex items-center justify-between bg-white dark:bg-[#2A2A2B] px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800/50 shadow-sm">
                            <div class="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">{{ item.titleKey ? t(item.titleKey) : (item.descriptionKey || 'Shortcut Action') }}</div>
                            <div class="flex items-center gap-1">
                                <span v-for="(key, kIdx) in item.pattern.split('+')" :key="kIdx" class="bg-neutral-100 dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold min-w-[20px] text-center shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_1px_1px_rgba(0,0,0,0.2)]">
                                    {{ key }}
                                </span>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
            <!-- Empty State Fallback -->
            <div v-if="getShortcutsRegistry().length === 0" class="text-center py-8 text-neutral-500 text-xs">
                No shortcuts registered.
            </div>
        </ScrollArea>
    </ConfirmModal>
  </div>
</template>

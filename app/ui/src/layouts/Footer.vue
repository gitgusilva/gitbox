<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { contextMenu } from '../services/modalService';
import { useI18n } from 'vue-i18n';
import Tooltip from '../components/Common/Tooltip.vue';
import { getItem, setItem } from '../services/storageService';
import { activeTab, repoPath } from '../services/gitService';
import { appVersion as version } from '../services/versionService';

const { t } = useI18n();

import { isShortcutsModalOpen } from '../services/modalService';

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
  <div class="h-[22px] bg-app border-t border-line flex items-center justify-between px-3 text-content text-[11px] select-none flex-shrink-0 z-50">
    
    <!-- Left Side: main-content panels (Command Log + Statistics side by side) -->
    <div class="flex items-center h-full">
        <Tooltip v-if="repoPath" :text="t('common.output_log')" position="top">
            <div
              @click="activeTab = activeTab === 'output_log' ? 'history' : 'output_log'"
              class="cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors h-full flex items-center px-2 gap-1.5"
              :class="{ 'text-accent bg-accent/10': activeTab === 'output_log' }"
            >
                <Icon icon="lucide:terminal" class="w-3.5 h-3.5" />
                <span class="font-medium">{{ t('common.output_log') }}</span>
            </div>
        </Tooltip>
        <Tooltip v-if="repoPath" :text="t('stats.title')" position="top">
            <div
              @click="activeTab = activeTab === 'statistics' ? 'history' : 'statistics'"
              class="cursor-pointer hover:text-neutral-900 dark:hover:text-white transition-colors h-full flex items-center px-2 gap-1.5 border-r border-line"
              :class="{ 'text-accent bg-accent/10': activeTab === 'statistics' }"
            >
                <Icon icon="lucide:chart-pie" class="w-3.5 h-3.5" />
                <span class="font-medium">{{ t('stats.title') }}</span>
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

        <div class="w-px h-3.5 bg-line hidden sm:block"></div>

        <div @click="openSupport" class="cursor-pointer hover:text-accent-hover transition-colors h-full flex items-center px-1 text-accent">
            {{ t('common.support') }}
        </div>
        
        <Tooltip :text="t('common.version')" position="top">
            <div class="flex items-center gap-1.5 h-full px-1">
                <span class="text-content-muted font-mono tracking-tight">GITBOX v{{ version }}</span>
            </div>
        </Tooltip>
    </div>

  </div>
</template>

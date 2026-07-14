<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FileTree from '../../../components/Common/FileTree.vue';
import DiffViewer from '../../../components/Common/DiffViewer.vue';
import SubmoduleInfoView from '../../../components/Common/SubmoduleInfoView.vue';
import { Icon } from '@iconify/vue';
import { historyDetailTreeWidth, layoutRefs } from '../../../services/layoutService';
import { repoPath } from '../../../services/gitService';
import { contextMenu } from '../../../services/modalService';
import { getItem, setItem } from '../../../services/storageService';
import Resizer from '../../../components/Common/Resizer.vue';
import Tooltip from '../../../components/Common/Tooltip.vue';

const props = defineProps<{
  files: any[];
  selectedPath: string;
  original: string;
  modified: string;
  submodules: any[];
}>();

const emit = defineEmits<{
  (e: 'select', path: string): void;
}>();

const { t } = useI18n();

// How the commit's file list is laid out. Persisted independently from the
// Local Changes panels so each keeps its own preference.
const viewMode = ref(getItem('gitbox_history_changes_view_mode') || 'tree');

// Toolbar glyph mirrors the active mode (same icons as the menu entries).
const VIEW_MODE_ICONS: Record<string, string> = { list: 'lucide:menu', flat: 'lucide:layout-grid', tree: 'lucide:git-branch' };
const viewModeIcon = (mode: string) => VIEW_MODE_ICONS[mode] || 'lucide:layout-grid';

function setViewMode(mode: string) {
  viewMode.value = mode;
  setItem('gitbox_history_changes_view_mode', mode);
  contextMenu.value = null;
}

/** Opens the view-options menu (list / flat / tree), mirroring the Changes panels. */
function openViewMenu(e: MouseEvent) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('changes_menu.view_list'), icon: 'lucide:menu', active: viewMode.value === 'list', action: () => setViewMode('list') },
      { label: t('changes_menu.view_flat'), icon: 'lucide:layout-grid', active: viewMode.value === 'flat', action: () => setViewMode('flat') },
      { label: t('changes_menu.view_tree'), icon: 'lucide:git-branch', active: viewMode.value === 'tree', action: () => setViewMode('tree') },
    ],
  };
}

const selectedSubmodule = computed(() => {
  if (!props.selectedPath) return null;
  return props.submodules.find(s => s.path === props.selectedPath) || null;
});

const submoduleSha = computed(() => {
  if (!props.selectedPath || !selectedSubmodule.value) return '';
  if (props.modified && props.modified.trim().length >= 7 && props.modified.trim().length <= 40) {
      return props.modified.trim();
  }
  return selectedSubmodule.value.sha || '';
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0 animate-in fade-in duration-300 overflow-hidden bg-app">
     <div class="flex-1 flex overflow-hidden h-full">
        <div class="border-r border-line bg-app flex-shrink-0 relative h-full flex flex-col overflow-hidden" :style="{ width: layoutRefs.historyDetailTreeWidth.value + 'px' }">
           <header class="bg-surface border-b border-line px-3 py-2 text-[10px] font-bold text-content-muted h-stack justify-between uppercase tracking-widest items-center shrink-0">
             <div class="h-stack items-center gap-2 min-w-0 flex-1">
               <Icon icon="lucide:file-diff" class="text-neutral-500 shrink-0" />
               <span class="truncate">{{ t('history.changes') }} ({{ files.length }})</span>
             </div>
             <Tooltip :text="t('changes.view_options')">
               <button @click="openViewMenu($event)" class="w-6 h-6 center hover:text-neutral-900 dark:hover:text-white transition-colors">
                 <Icon :icon="viewModeIcon(viewMode)" class="text-xs" />
               </button>
             </Tooltip>
           </header>
           <div class="flex-1 min-h-0 overflow-hidden">
             <FileTree :files="files" :viewMode="viewMode" :selectedPath="selectedPath" @select="emit('select', $event)" />
           </div>
           <Resizer :target="layoutRefs.historyDetailTreeWidth" :options="{ min: 120, max: 800, clampToContainer: true, reserve: 240 }" class="absolute right-0 top-0 bottom-0 translate-x-1/2" />
        </div>

        <div class="flex-1 flex flex-col min-w-0 h-full">
           <template v-if="selectedPath">
              <template v-if="selectedSubmodule">
                 <div class="flex-1 flex flex-col overflow-hidden min-h-0 relative">
                    <DiffViewer :original="original" :modified="modified" :filename="selectedPath" class="flex-1" />
                    <Resizer vertical :target="layoutRefs.submoduleDetailHeight" :options="{ axis: 'y', invert: true, min: 100, max: 800 }" class="absolute bottom-0 left-0 right-0 h-1 z-30 bg-neutral-200/50 dark:bg-neutral-800/50 hover:bg-blue-500/50" />
                 </div>
                 
                 <div :style="{ height: layoutRefs.submoduleDetailHeight.value + 'px' }" class="flex-shrink-0 border-t border-line bg-app relative">
                    <SubmoduleInfoView :path="selectedPath" :sha="submoduleSha" />
                 </div>
              </template>
              <DiffViewer v-else :original="original" :modified="modified" :filename="selectedPath" class="h-full" />
           </template>
           <div v-else class="flex-1 h-full flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8 bg-app">
               <Icon icon="lucide:file-diff" class="text-5xl mb-4 opacity-10" />
               <div class="font-bold uppercase tracking-widest text-sm opacity-20">{{ t('history_detail.select_file_from_changes') }}</div>
           </div>
        </div>
     </div>
  </div>
</template>

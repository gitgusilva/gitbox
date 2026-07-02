<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import FileTree from '../../../components/Common/FileTree.vue';
import DiffViewer from '../../../components/Common/DiffViewer.vue';
import SubmoduleInfoView from '../../../components/Common/SubmoduleInfoView.vue';
import { Icon } from '@iconify/vue';
import { historyDetailTreeWidth, layoutRefs } from '../../../services/layoutService';
import { repoPath } from '../../../services/gitService';
import Resizer from '../../../components/Common/Resizer.vue';

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
  <div class="h-full flex flex-col min-h-0 animate-in fade-in duration-300 overflow-hidden bg-neutral-50 dark:bg-[#1A1A1A]">
     <div class="flex-1 flex overflow-hidden h-full">
        <div class="border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1A1A1A] flex-shrink-0 relative h-full flex flex-col overflow-hidden" :style="{ width: layoutRefs.historyDetailTreeWidth.value + 'px' }">
           <FileTree :files="files" :selectedPath="selectedPath" @select="emit('select', $event)" />
           <Resizer :target="layoutRefs.historyDetailTreeWidth" :options="{ min: 120, max: 800, clampToContainer: true, reserve: 240 }" class="absolute right-0 top-0 bottom-0 translate-x-1/2" />
        </div>

        <div class="flex-1 flex flex-col min-w-0 h-full">
           <template v-if="selectedPath">
              <template v-if="selectedSubmodule">
                 <div class="flex-1 flex flex-col overflow-hidden min-h-0 relative">
                    <DiffViewer :original="original" :modified="modified" :filename="selectedPath" class="flex-1" />
                    <Resizer vertical :target="layoutRefs.submoduleDetailHeight" :options="{ axis: 'y', invert: true, min: 100, max: 800 }" class="absolute bottom-0 left-0 right-0 h-1 z-30 bg-neutral-200/50 dark:bg-neutral-800/50 hover:bg-blue-500/50" />
                 </div>
                 
                 <div :style="{ height: layoutRefs.submoduleDetailHeight.value + 'px' }" class="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#1E1E1E] relative">
                    <SubmoduleInfoView :path="selectedPath" :sha="submoduleSha" />
                 </div>
              </template>
              <DiffViewer v-else :original="original" :modified="modified" :filename="selectedPath" class="h-full" />
           </template>
           <div v-else class="flex-1 h-full flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8 bg-white dark:bg-[#1e1e1e]">
               <Icon icon="lucide:file-diff" class="text-5xl mb-4 opacity-10" />
               <div class="font-bold uppercase tracking-widest text-sm opacity-20">{{ t('history_detail.select_file_from_changes') }}</div>
           </div>
        </div>
     </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import FileTree from '../../../components/Common/FileTree.vue';
import DiffViewer from '../../../components/Common/DiffViewer.vue';
import { Icon } from '@iconify/vue';
import { historyDetailTreeWidth, layoutRefs } from '../../../services/layoutService';
import Resizer from '../../../components/Common/Resizer.vue';

const props = defineProps<{
  files: any[];
  selectedPath: string;
  content: string;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', path: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="h-full flex flex-col min-h-0 animate-in fade-in duration-300 bg-neutral-50 dark:bg-[#1A1A1A] overflow-hidden">
     <div class="flex-1 flex overflow-hidden h-full">
        <div class="border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1A1A1A] flex-shrink-0 relative h-full flex flex-col overflow-hidden" :style="{ width: layoutRefs.historyDetailTreeWidth.value + 'px' }">
           <FileTree v-if="files.length" :files="files" :selectedPath="selectedPath" @select="emit('select', $event)" />
           <div v-else-if="isLoading" class="p-8 text-center">
               <Icon icon="lucide:loader-2" class="animate-spin text-blue-500 mx-auto mb-2" />
               <span class="text-[9px] text-neutral-500 uppercase font-bold tracking-widest">{{ t('history_detail.loading_tree') }}</span>
           </div>
           <div v-else class="p-8 text-center text-neutral-600 uppercase text-[9px] font-bold tracking-widest opacity-50">
               {{ t('history_detail.empty_repository_tree') }}
           </div>
           <Resizer :target="layoutRefs.historyDetailTreeWidth" :options="{ min: 120, max: 800, clampToContainer: true, reserve: 240 }" class="absolute right-0 top-0 bottom-0" />
        </div>

        <div class="flex-1 flex flex-col min-w-0 h-full">
           <DiffViewer v-if="selectedPath" :original="''" :modified="content" :filename="selectedPath" :readOnly="true" class="h-full" />
           <div v-else class="flex-1 h-full flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8 bg-white dark:bg-[#1e1e1e]">
               <Icon icon="lucide:file-text" class="text-5xl mb-4 opacity-10" />
               <div class="font-bold uppercase tracking-widest text-sm opacity-20">{{ t('history_detail.select_file_from_repository') }}</div>
           </div>
        </div>
     </div>
  </div>
</template>

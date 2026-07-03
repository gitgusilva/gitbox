<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { repoPath } from '../../services/gitService';

const { t } = useI18n();
import FileTree from '../../components/Common/FileTree.vue';
import DiffViewer from '../../components/Common/DiffViewer.vue';

const files = ref<any[]>([]);
const selectedPath = ref('');
const content = ref('');
const isLoading = ref(false);

async function loadFiles() {
    if (!repoPath.value) return;
    isLoading.value = true;
    try {
        const filePaths = await window.gitbox.listFiles(repoPath.value);
        files.value = filePaths.map((p: string) => ({ path: p, status: 'modified' }));
    } catch (e) {
        files.value = [];
    } finally {
        isLoading.value = false;
    }
}

async function loadContent() {
    if (!repoPath.value || !selectedPath.value) {
        content.value = '';
        return;
    }
    try {
        const c = await window.gitbox.getFileContent(repoPath.value, selectedPath.value);
        content.value = c;
    } catch (e) {
        content.value = '';
    }
}

watch(repoPath, loadFiles, { immediate: true });
watch(selectedPath, loadContent);

onMounted(loadFiles);
</script>

<template>
  <div class="flex-1 flex min-h-0 bg-app">
    <div class="w-72 border-r border-line flex flex-col min-h-0 overflow-hidden bg-app">
        <header class="h-10 border-b border-line flex items-center px-4 bg-surface">
            <span class="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{{ t('view.repository_files') }}</span>
        </header>
        <div class="flex-1 relative overflow-hidden flex flex-col">
            <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                <Icon icon="lucide:loader-2" class="animate-spin text-blue-500" />
            </div>
            <FileTree :files="files" :selectedPath="selectedPath" @select="selectedPath = $event" />
        </div>
    </div>
    <div class="flex-1 flex flex-col min-h-0 relative">
        <DiffViewer v-if="selectedPath" 
                    :original="''" 
                    :modified="content" 
                    :filename="selectedPath"
                    :readOnly="true" />
        <div v-else class="flex-1 flex flex-col items-center justify-center text-neutral-600 pointer-events-none text-center p-8 bg-app">
            <Icon icon="lucide:folder-search" class="text-5xl mb-4 opacity-10" />
            <div class="font-bold uppercase tracking-widest text-sm opacity-20">{{ t('view.select_file_from_tree') }}</div>
        </div>
    </div>
  </div>
</template>

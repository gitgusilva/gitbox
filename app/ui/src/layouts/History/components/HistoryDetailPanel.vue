<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { Commit } from '../../../types/git';
import CommitInfoView from '../../../components/Common/CommitInfoView.vue';
import SubmoduleInfoView from '../../../components/Common/SubmoduleInfoView.vue';
import HistoryCommitChanges from './HistoryCommitChanges.vue';
import HistoryCommitFiles from './HistoryCommitFiles.vue';
import Tabs from '../../../components/Common/Tabs.vue';
import Tab from '../../../components/Common/Tab.vue';
import Tooltip from '../../../components/Common/Tooltip.vue';
import Resizer from '../../../components/Common/Resizer.vue';
import { detailsWidth, layoutRefs } from '../../../services/layoutService';
import { submodules } from '../../../services/gitService';

const props = defineProps<{
  selectedCommits: Commit[];
  commitRefs: { name: string, type: 'branch' | 'tag' | 'remote', isHead?: boolean }[];
  commitFilesList: any[];
  selectedCommitFile: string;
  commitOriginal: string;
  commitModified: string;
  fullRepoFilesList: any[];
  selectedFilesTabPath: string;
  filesTabContent: string;
  isTreeLoading: boolean;
  /** When set (transiently) by the parent, switch to this tab. */
  requestedTab?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'explain'): void;
  (e: 'navigate', commit: any): void;
  (e: 'selectChange', path: string): void;
  (e: 'selectFile', path: string): void;
  (e: 'setTab', tab: string): void;
}>();

const { t } = useI18n();
const activeDetailTab = ref('information');

// Let the parent drive the active tab (e.g. an AI file link jumps to "changes").
watch(() => props.requestedTab, (tab) => {
    if (tab) activeDetailTab.value = tab;
});

const selectedSubmodule = computed(() => {
    if (!props.selectedCommitFile) return null;
    return submodules.value.find(s => s.path === props.selectedCommitFile);
});

const submoduleSha = computed(() => {
    if (!selectedSubmodule.value) return '';
    if (props.commitModified && props.commitModified.trim().length >= 7 && props.commitModified.trim().length <= 40) {
        return props.commitModified.trim();
    }
    return selectedSubmodule.value.sha || '';
});

watch(selectedSubmodule, (newVal) => {
    if (newVal) {
        activeDetailTab.value = 'submodule';
    } else if (activeDetailTab.value === 'submodule') {
        activeDetailTab.value = 'changes';
    }
});

function onSetTab(tab: string) {
    activeDetailTab.value = tab;
    emit('setTab', tab);
}
</script>

<template>
  <div class="flex flex-col bg-overlay border-l border-neutral-200 dark:border-transparent flex-shrink-0 relative shadow-none dark:shadow-2xl z-10 min-h-0 overflow-hidden" :style="{ width: layoutRefs.detailsWidth.value + 'px' }">
    <Resizer :target="layoutRefs.detailsWidth" :options="{ invert: true, min: 200, max: 1200, clampToContainer: true, reserve: 260 }" class="absolute left-0 top-0 bottom-0 -translate-x-1/2 z-30" />
    
    <!-- Top Title Bar like SourceGit: commit pinned left, explain as an icon
         button on the right. Both flex so they adapt when the panel is resized. -->
    <div v-if="selectedCommits.length === 1" class="flex-shrink-0 bg-surface border-b border-line flex items-center justify-between gap-2 px-3 h-[42px] min-w-0">
        <div class="flex items-center gap-1.5 min-w-0">
            <span class="text-xs text-content-muted shrink-0">{{ t('history_detail.commit_label') }}</span>
            <span class="text-xs font-mono font-bold tracking-wider text-content-strong truncate">{{ selectedCommits[0].id.substring(0,6) }}</span>
        </div>

        <Tooltip :text="t('history_detail.explain_commit')" position="bottom">
            <button @click="emit('explain')" class="h-7 w-7 flex items-center justify-center bg-accent hover:bg-accent-hover text-accent-fg rounded transition-colors outline-none shadow-sm shrink-0">
                <Icon icon="lucide:sparkles" class="text-sm" />
            </button>
        </Tooltip>
    </div>

    <!-- Multiple Commits Title Bar -->
    <div v-if="selectedCommits.length > 1" class="flex-shrink-0 bg-surface border-b border-line flex items-center justify-between gap-2 px-3 h-[42px] min-w-0">
        <span class="text-xs text-content-strong font-bold truncate min-w-0">{{ t('history_detail.n_commits_selected', { count: selectedCommits.length }) }}</span>

        <Tooltip :text="t('history_detail.explain_commits')" position="bottom">
            <button @click="emit('explain')" class="h-7 w-7 flex items-center justify-center bg-accent hover:bg-accent-hover text-accent-fg rounded transition-colors outline-none shadow-sm shrink-0">
                <Icon icon="lucide:sparkles" class="text-sm" />
            </button>
        </Tooltip>
    </div>

    <div v-if="selectedCommits.length === 1" class="flex-1 overflow-hidden flex flex-col">
        <Tabs v-model="activeDetailTab" @change="emit('setTab', $event)">
            <template #tab-actions>
                 <Tooltip :text="t('history_detail.close_details')" position="bottom">
                   <button @click="emit('close')"
                           class="h-7 w-7 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors outline-none">
                      <Icon icon="lucide:x" class="text-base" />
                   </button>
                 </Tooltip>
            </template>

            <Tab id="information" :label="t('history_detail.tab_information')">
                <CommitInfoView 
                    :commit="selectedCommits[0]" 
                    :commitRefs="commitRefs"
                    :changedFiles="commitFilesList"
                    @navigate="emit('navigate', $event)"
                    @selectFile="onSetTab('changes'); emit('selectChange', $event)"
                />
            </Tab>

            <Tab id="changes" :label="t('history_detail.tab_changes')">
                <HistoryCommitChanges 
                    :files="commitFilesList"
                    :selectedPath="selectedCommitFile"
                    :original="commitOriginal"
                    :modified="commitModified"
                    :submodules="submodules"
                    @select="emit('selectChange', $event)"
                />
            </Tab>

            <Tab v-if="selectedSubmodule" id="submodule" :label="t('history_detail.tab_submodule')">
                <SubmoduleInfoView :path="selectedSubmodule.path" :sha="submoduleSha" />
            </Tab>

            <Tab id="files" :label="t('history_detail.tab_files')">
                <HistoryCommitFiles 
                    :files="fullRepoFilesList"
                    :selectedPath="selectedFilesTabPath"
                    :content="filesTabContent"
                    :isLoading="isTreeLoading"
                    @select="emit('selectFile', $event)"
                />
            </Tab>
        </Tabs>
    </div>
  </div>
</template>

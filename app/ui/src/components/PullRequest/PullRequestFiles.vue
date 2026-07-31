<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import DiffStat from '../Common/DiffStat.vue';
import FileStatusIcon from '../Common/FileStatusIcon.vue';
import type { PullRequestFile } from '../../services/pullRequestService';

/**
 * The changed-file list. Presentation only — the state lives in
 * `usePullRequestFiles` so the diff panel can share it.
 */
defineProps<{
    files: PullRequestFile[];
    isLoading?: boolean;
    loadError?: string | null;
    totals?: { additions: number; deletions: number };
    /** Path of the file currently open in the diff panel. */
    activePath?: string | null;
}>();

const emit = defineEmits<{
    (e: 'select', index: number): void;
    (e: 'refresh'): void;
}>();

const { t } = useI18n();
</script>

<template>
    <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs font-medium text-content">
            <span>{{ t('pr_view.files_changed', { count: files.length }) }}</span>
            <div class="flex items-center gap-3">
                <DiffStat v-if="files.length && totals" :additions="totals.additions" :deletions="totals.deletions" />
                <button @click="emit('refresh')" class="text-content-muted hover:text-content-strong" :class="{ 'animate-spin text-accent': isLoading }">
                    <Icon icon="lucide:refresh-cw" />
                </button>
            </div>
        </div>

        <div v-if="loadError" class="text-[11px] text-removed">{{ loadError }}</div>
        <div v-else-if="!files.length && !isLoading" class="text-[11px] text-content-muted italic">
            {{ t('pr_view.no_files') }}
        </div>

        <div v-else class="border border-line rounded-lg overflow-hidden divide-y divide-line">
            <button v-for="(file, index) in files" :key="file.path"
                    @click="emit('select', index)"
                    class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors group"
                    :class="file.path === activePath ? 'bg-accent/15' : 'hover:bg-surface-hover'">
                <FileStatusIcon :status="file.status" class="text-sm" />
                <span class="flex-1 min-w-0 truncate font-mono text-[11px]"
                      :class="file.path === activePath ? 'text-accent' : 'text-content group-hover:text-content-strong'">
                    {{ file.path }}
                    <span v-if="file.previousPath" class="text-content-muted"> ← {{ file.previousPath }}</span>
                </span>
                <DiffStat :additions="file.additions" :deletions="file.deletions" compact />
            </button>
        </div>
    </div>
</template>

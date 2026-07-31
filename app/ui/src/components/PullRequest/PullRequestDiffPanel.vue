<script setup lang="ts">
import { Icon } from '@iconify/vue';
import DockedPanel from '../Common/DockedPanel.vue';
import DiffFileHeader from '../Common/DiffFileHeader.vue';
import DiffViewer from '../Common/DiffViewer.vue';
import { detailsOrientation, layoutRefs } from '../../services/layoutService';
import type { PullRequestFile } from '../../services/pullRequestService';

/**
 * Docks a pull request file's diff beside the conversation, on whichever side
 * the history details panel uses, so reviewing a file never hides the PR.
 */
defineProps<{
    file: PullRequestFile;
    original: string;
    modified: string;
    isLoading?: boolean;
    error?: string | null;
    /** Position in the file list, for the "3 / 12" counter. */
    index: number;
    total: number;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'detach'): void;
    (e: 'step', direction: 1 | -1): void;
}>();
</script>

<template>
    <DockedPanel v-model:orientation="detailsOrientation"
                 :width-target="layoutRefs.prDiffWidth"
                 :height-target="layoutRefs.prDiffHeight"
                 detachable
                 @detach="emit('detach')"
                 @close="emit('close')">
        <template #header>
            <DiffFileHeader :file="file" :index="index" :total="total" @step="emit('step', $event)" />
        </template>

        <div v-if="isLoading" class="flex-1 flex items-center justify-center text-content-muted">
            <Icon icon="lucide:loader-2" class="animate-spin text-xl" />
        </div>
        <div v-else-if="error" class="flex-1 flex items-center justify-center text-xs text-content-muted px-6 text-center">
            {{ error }}
        </div>
        <DiffViewer v-else
                    :key="file.path"
                    :original="original"
                    :modified="modified"
                    :filename="file.path"
                    :read-only="true"
                    hide-filename
                    class="flex-1 min-h-0" />
    </DockedPanel>
</template>

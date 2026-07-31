<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import DiffStat from './DiffStat.vue';
import FileStatusIcon from './FileStatusIcon.vue';
import Tooltip from './Tooltip.vue';
import type { PullRequestFileSummary } from '../../types/git';

/**
 * Identifies the file a diff is showing and steps through the set it belongs
 * to. Shared by the docked panel and the detached window so the two cannot
 * drift — they had already disagreed on when "next" is disabled.
 */
defineProps<{
    file: PullRequestFileSummary;
    /** Position in the file list, for the "3 / 12" counter. */
    index: number;
    total: number;
}>();

const emit = defineEmits<{ (e: 'step', direction: 1 | -1): void }>();

const { t } = useI18n();
</script>

<template>
    <FileStatusIcon :status="file.status" class="text-sm" />
    <Tooltip :text="file.path" class="flex-1 min-w-0">
        <span class="block truncate font-mono text-[11px] text-content-strong text-left">{{ file.path }}</span>
    </Tooltip>
    <DiffStat :additions="file.additions" :deletions="file.deletions" compact />
    <span class="text-[10px] text-content-muted tabular-nums shrink-0">{{ index + 1 }} / {{ total }}</span>

    <Tooltip :text="t('pr_view.previous_file')" position="bottom">
        <button @click="emit('step', -1)" :disabled="index <= 0"
                class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-content-muted hover:text-content-strong disabled:opacity-30">
            <Icon icon="lucide:chevron-up" />
        </button>
    </Tooltip>
    <Tooltip :text="t('pr_view.next_file')" position="bottom">
        <button @click="emit('step', 1)" :disabled="index >= total - 1"
                class="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-content-muted hover:text-content-strong disabled:opacity-30">
            <Icon icon="lucide:chevron-down" />
        </button>
    </Tooltip>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import Tooltip from '../Common/Tooltip.vue';
import DiffStat from '../Common/DiffStat.vue';
import { formatDate, formatFullDate } from '../../utils/formatters';
import type { PullRequest } from '../../services/pullRequestService';

/**
 * The counters a reviewer looks for before opening the diff. Everything here
 * comes from the provider's detail payload, so each row falls back to a dash
 * until that lands.
 */
defineProps<{ pr: PullRequest }>();

const { t } = useI18n();
</script>

<template>
    <div class="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] items-center">
        <div class="text-content-muted">{{ t('pr_view.files_changed', { count: pr.changed_files ?? 0 }) }}</div>
        <DiffStat class="justify-end" :additions="pr.additions ?? 0" :deletions="pr.deletions ?? 0" />

        <div class="text-content-muted">{{ t('pr_view.commits') }}</div>
        <div class="text-content text-right font-mono tabular-nums">{{ pr.commits ?? '—' }}</div>

        <!-- Only an open PR has a merge check to report; a merged or closed one
             would otherwise sit forever on "checking". -->
        <template v-if="pr.state === 'open'">
            <div class="text-content-muted">{{ t('pr_view.mergeable') }}</div>
            <div class="text-right font-medium"
                 :class="pr.mergeable === true ? 'text-added' : pr.mergeable === false ? 'text-removed' : 'text-content-muted'">
                {{ pr.mergeable === true ? t('pr_view.mergeable_yes') : pr.mergeable === false ? t('pr_view.mergeable_no') : t('pr_view.mergeable_unknown') }}
            </div>
        </template>

        <div class="text-content-muted">{{ t('pr_view.created') }}</div>
        <Tooltip :text="formatFullDate(pr.createdAt)" position="left" class="text-right">
            <span class="text-content">{{ formatDate(pr.createdAt) }}</span>
        </Tooltip>

        <template v-if="pr.updatedAt">
            <div class="text-content-muted">{{ t('pr_view.updated') }}</div>
            <Tooltip :text="formatFullDate(pr.updatedAt)" position="left" class="text-right">
                <span class="text-content">{{ formatDate(pr.updatedAt) }}</span>
            </Tooltip>
        </template>
    </div>
</template>

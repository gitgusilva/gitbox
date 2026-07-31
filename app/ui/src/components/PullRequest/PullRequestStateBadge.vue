<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import {
    PR_STATE_BADGE_CLASS,
    PR_STATE_ICON,
    pullRequestStateKey,
    pullRequestStateLabelKey,
} from '../../services/pullRequests/state';

/** The open / draft / merged / closed pill. */
const props = withDefaults(defineProps<{
    state?: string;
    draft?: boolean;
}>(), {
    state: 'open',
});

const { t } = useI18n();

const key = computed(() => pullRequestStateKey(props.state, props.draft));
const label = computed(() => t(pullRequestStateLabelKey(key.value)));
</script>

<template>
    <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 transition-colors"
         :class="PR_STATE_BADGE_CLASS[key]">
        <Icon :icon="PR_STATE_ICON[key]" class="text-[13px]" />
        {{ label }}
    </div>
</template>

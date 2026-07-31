<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import Tooltip from './Tooltip.vue';
import { isSafeExternalUrl, openExternalUrl } from '../../utils/formatters';

/**
 * A branch name chip. With a `url` it becomes a link to the branch on the
 * forge (opened in the OS browser); without one it is plain text, so the same
 * chip works for local branches.
 */
const props = defineProps<{
    name?: string;
    url?: string;
}>();

const isLink = computed(() => isSafeExternalUrl(props.url));

// The URL is the useful hover text when there is one — the name is already
// on screen, and a truncated one needs the full value somewhere.
const tooltipText = computed(() => (isLink.value ? props.url! : props.name || ''));
</script>

<template>
    <Tooltip :text="tooltipText">
        <button type="button"
                :disabled="!isLink"
                @click="openExternalUrl(url!)"
                class="bg-accent/15 text-accent px-1.5 py-0.5 rounded font-mono text-xs inline-flex items-center gap-1 max-w-[240px] transition-colors enabled:hover:bg-accent/25 disabled:cursor-default">
            <span class="truncate">{{ name }}</span>
            <Icon v-if="isLink" icon="lucide:external-link" class="text-[10px] opacity-70 shrink-0" />
        </button>
    </Tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

/**
 * One icon per change kind, colored from the diff tokens.
 *
 * Takes the normalized vocabulary from `PullRequestFile['status']`. The commit
 * and working-tree file lists still carry raw git status strings and map their
 * own icons; folding them in needs that normalization first.
 */
const props = withDefaults(defineProps<{
    status?: 'added' | 'removed' | 'modified' | 'renamed' | string;
    class?: string;
}>(), {
    status: 'modified',
});

const icon = computed(() => ({
    added: 'lucide:file-plus-2',
    removed: 'lucide:file-minus-2',
    renamed: 'lucide:file-symlink',
    modified: 'lucide:file-pen-line',
}[props.status] || 'lucide:file-pen-line'));

const tone = computed(() => ({
    added: 'text-added',
    removed: 'text-removed',
    renamed: 'text-modified',
    modified: 'text-modified',
}[props.status] || 'text-modified'));
</script>

<template>
    <Icon :icon="icon" :class="['shrink-0', tone, props.class]" />
</template>

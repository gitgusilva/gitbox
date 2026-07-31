<script setup lang="ts">
/**
 * The `+12 / -3` pair, themed and aligned the same way everywhere it appears
 * (file rows, PR summaries, commit details).
 */
withDefaults(defineProps<{
    additions?: number;
    deletions?: number;
    /** Drops the separator for tight rows. */
    compact?: boolean;
}>(), {
    additions: 0,
    deletions: 0,
});
</script>

<template>
    <span class="inline-flex items-center font-mono text-[11px] tabular-nums shrink-0">
        <span class="text-added">+{{ additions }}</span>
        <span class="text-content-muted">{{ compact ? ' ' : ' / ' }}</span>
        <span class="text-removed">-{{ deletions }}</span>
    </span>
</template>

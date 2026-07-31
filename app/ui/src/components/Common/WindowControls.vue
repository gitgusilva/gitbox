<script setup lang="ts">
import { Icon } from '@iconify/vue';

/**
 * Minimize / maximize / close for windows that hide the native title bar.
 * Shared so every GitBox window (main, merge editor, detached diff) presents
 * the same flush, full-height controls.
 *
 * Place inside a `-webkit-app-region: drag` bar; the component opts itself out
 * of the drag region so the buttons stay clickable.
 */
const minimize = () => window.gitbox.minimize();
const maximize = () => window.gitbox.maximize();
const close = () => window.gitbox.close();
</script>

<template>
    <div class="flex h-full shrink-0" style="-webkit-app-region: no-drag;">
        <div class="w-12 h-full flex items-center justify-center text-content-muted hover:bg-surface-hover hover:text-content-strong transition-colors cursor-pointer"
             @click="minimize">
            <Icon icon="lucide:minus" class="w-4 h-4" />
        </div>
        <div class="w-12 h-full flex items-center justify-center text-content-muted hover:bg-surface-hover hover:text-content-strong transition-colors cursor-pointer"
             @click="maximize">
            <Icon icon="lucide:square" class="w-3.5 h-3.5" />
        </div>
        <div class="w-12 h-full flex items-center justify-center text-content-muted hover:bg-removed hover:text-removed-fg transition-colors cursor-pointer"
             @click="close">
            <Icon icon="lucide:x" class="w-4 h-4" />
        </div>
    </div>
</template>

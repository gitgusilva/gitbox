<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { cn } from '../../utils/cn';

/**
 * Standardized app button. Every visual state resolves to the live theme
 * (`--gb-accent` and friends) so it stays in sync with the theme editor.
 * Use this instead of hand-rolling `bg-blue-600` / `bg-[#hex]` buttons.
 */
const props = withDefaults(defineProps<{
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
    size?: 'sm' | 'md';
    icon?: string;
    loadingIcon?: string;
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
    block?: boolean;
    class?: string;
}>(), {
    variant: 'primary',
    size: 'md',
    type: 'button',
});

const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>();

const variantClass = computed(() => {
    switch (props.variant) {
        case 'primary':
            return 'bg-accent hover:bg-accent-hover text-accent-fg border border-transparent shadow-sm';
        case 'secondary':
            return 'bg-surface hover:bg-surface-hover text-content border border-line-strong';
        case 'success':
            return 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/40 shadow-sm';
        case 'danger':
            return 'bg-red-600 hover:bg-red-500 text-white border border-red-500/40 shadow-sm';
        case 'ghost':
            return 'bg-transparent hover:bg-surface-hover text-content-muted hover:text-content-strong border border-transparent';
        default:
            return '';
    }
});

const sizeClass = computed(() => props.size === 'sm'
    ? 'px-3 py-1 text-[10px] uppercase font-bold tracking-tighter gap-1.5 rounded'
    : 'px-4 py-2 text-xs font-semibold gap-2 rounded');

const currentIcon = computed(() => props.loading ? (props.loadingIcon || 'lucide:loader-2') : props.icon);

function handleClick(e: MouseEvent) {
    if (props.disabled || props.loading) return;
    emit('click', e);
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    @click="handleClick"
    :class="cn(
      'inline-flex items-center justify-center transition-all shrink-0 outline-none whitespace-nowrap',
      'disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]',
      block ? 'w-full' : '',
      sizeClass,
      variantClass,
      props.class
    )">
    <Icon v-if="currentIcon" :icon="currentIcon" :class="cn('shrink-0', loading && 'animate-spin')" />
    <slot />
  </button>
</template>

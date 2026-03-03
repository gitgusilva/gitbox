<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import Tooltip from './Tooltip.vue';
import { generalSettings } from '../../services/settingsService';

const props = withDefaults(defineProps<{
    icon: string;
    loadingIcon?: string;
    label: string;
    action?: (e: MouseEvent) => void;
    disabled?: boolean;
    loading?: boolean;
    showLabel?: boolean; // if undefined, uses generalSettings.value.hideIconLabels
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
    tooltip?: string;
    variant?: 'default' | 'primary' | 'danger' | 'success' | 'ghost'; // styling variants if needed
    iconClass?: string;
    direction?: 'row' | 'col';
    active?: boolean;
}>(), {
    tooltipPosition: 'bottom',
    variant: 'default',
    direction: 'col'
});

const hideLabelSetting = computed(() => generalSettings.value.hideIconLabels);

const hideLabel = computed(() => {
    if (props.showLabel !== undefined) return !props.showLabel;
    return hideLabelSetting.value;
});

const tooltipText = computed(() => {
    if (props.tooltip) return props.tooltip;
    if (hideLabel.value) return props.label;
    return '';
});

const isGhost = computed(() => props.variant === 'ghost');
const isPrimary = computed(() => props.variant === 'primary');

const currentIcon = computed(() => props.loading ? (props.loadingIcon || 'lucide:loader-2') : props.icon);

function handleClick(e: MouseEvent) {
    if (props.disabled || props.loading) return;
    if (props.action) props.action(e);
}
</script>

<template>
  <Tooltip :text="tooltipText" :position="tooltipPosition" :delay="400">
    <button @click="handleClick" 
            :disabled="disabled || loading" 
            class="flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-wait shrink-0 outline-none"
            :class="{
               'flex-col gap-0.5 py-1 px-2.5 rounded min-w-[50px]': !hideLabel && direction === 'col',
               'flex-row gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-tighter': !hideLabel && direction === 'row',
               'flex-row p-1.5 rounded w-8 h-8': hideLabel,
               'text-neutral-500 hover:text-white dark:hover:bg-neutral-600 hover:bg-neutral-200': isGhost && !active,
               'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-neutral-600': !isGhost && !isPrimary && !active,
               'bg-blue-600 text-white hover:bg-blue-500': isPrimary && !active,
               'bg-blue-600/20 text-blue-400': active,
            }">
      <Icon :icon="currentIcon" 
            :class="[{ 'animate-spin': loading, 'text-xs': direction === 'row', 'text-lg': direction === 'col' }, iconClass]" 
            class="shrink-0" />
      <span v-if="!hideLabel" class="whitespace-nowrap" :class="direction === 'col' ? 'text-[9px] font-medium' : ''">{{ label }}</span>
    </button>
  </Tooltip>
</template>

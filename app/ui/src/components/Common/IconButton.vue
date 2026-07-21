<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import Tooltip from './Tooltip.vue';
import { generalSettings } from '../../services/settingsService';
import { cn } from '../../utils/cn';

const props = withDefaults(defineProps<{
    icon: string;
    loadingIcon?: string;
    label: string;
    action?: (e: MouseEvent) => void;
    disabled?: boolean;
    loading?: boolean;
    /** Force the label on/off. Left undefined → follows generalSettings.hideIconLabels. */
    showLabel?: boolean;
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
    tooltip?: string;
    variant?: 'default' | 'primary' | 'danger' | 'success' | 'ghost' | 'sidebar';
    iconClass?: string;
    direction?: 'row' | 'col';
    active?: boolean;
}>(), {
    // MUST stay explicitly `undefined`: Vue casts an ABSENT Boolean prop with no
    // declared default to `false`, which made `showLabel` read as an explicit
    // "hide the label" on every call site and silently overrode the
    // hideIconLabels setting. Declaring the default keeps it undefined.
    showLabel: undefined,
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
const isSidebar = computed(() => props.variant === 'sidebar');

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
            :class="cn(
               'center transition-colors disabled:opacity-50 disabled:cursor-wait shrink-0 outline-none',
               !hideLabel && direction === 'col' ? 'v-stack gap-0.5 py-1 px-2.5 rounded min-w-[50px]' : '',
               !hideLabel && direction === 'row' ? 'h-stack gap-1.5 px-2.5 py-1 rounded text-[10px] uppercase font-bold tracking-tighter' : '',
               hideLabel ? 'center p-1.5 rounded w-8 h-8' : '',
               (isGhost || isSidebar) && !active ? 'text-content-muted hover:text-content-strong hover:bg-surface-hover' : '',
               variant === 'default' && !active ? 'text-content-muted hover:text-content-strong hover:bg-surface-hover' : '',
               isPrimary && !active ? 'bg-accent text-accent-fg hover:bg-accent-hover' : '',
               variant === 'danger' && !active ? 'text-removed hover:text-removed hover:bg-removed/10' : '',
               active ? 'bg-accent/20 text-accent' : '',
               isSidebar && active ? 'text-accent bg-surface-hover' : ''
            )">
      <Icon :icon="currentIcon" 
            :class="cn(
              { 'animate-spin': loading, 'text-xs': direction === 'row', 'text-lg': direction === 'col' }, 
              iconClass,
              'shrink-0'
            )" />
      <span v-if="!hideLabel" :class="cn('whitespace-nowrap', direction === 'col' ? 'text-[9px] font-medium' : '')">{{ label }}</span>
    </button>
  </Tooltip>
</template>

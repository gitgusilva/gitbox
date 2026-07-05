<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';
import { cn } from '../../utils/cn';

const props = defineProps<{
    modelValue: boolean;
    label?: string;
    class?: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
}>();

const checked = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});
</script>

<template>
  <label :class="cn('h-stack gap-3 cursor-pointer group', props.class)">
      <div :class="cn(
            'center w-4 h-4 rounded border transition-all shrink-0',
            checked ? 'bg-accent border-accent' : 'bg-surface border-line-strong group-hover:border-neutral-500'
           )">
          <Icon v-if="checked" icon="lucide:check" class="text-[10px] text-accent-fg" />
      </div>
      <input type="checkbox" v-model="checked" class="hidden" />
      <div v-if="label || $slots.default" class="text-[11px] text-content-muted group-hover:text-neutral-800 dark:group-hover:text-neutral-200 transition-colors w-full">
          <slot>{{ label }}</slot>
      </div>
  </label>
</template>

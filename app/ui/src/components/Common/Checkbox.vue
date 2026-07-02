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
            checked ? 'bg-blue-600 border-blue-600' : 'bg-neutral-100 dark:bg-[#252526] border-neutral-300 dark:border-neutral-700 group-hover:border-neutral-500'
           )">
          <Icon v-if="checked" icon="lucide:check" class="text-[10px] text-white" />
      </div>
      <input type="checkbox" v-model="checked" class="hidden" />
      <div v-if="label || $slots.default" class="text-[11px] text-neutral-600 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 transition-colors w-full">
          <slot>{{ label }}</slot>
      </div>
  </label>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed } from 'vue';

const props = defineProps<{
    modelValue: boolean;
    label?: string;
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
  <label class="flex items-center gap-3 cursor-pointer group">
      <div class="w-4 h-4 rounded border border-neutral-700 flex items-center justify-center transition-all shrink-0"
           :class="checked ? 'bg-blue-600 border-blue-600' : 'bg-[#252526] group-hover:border-neutral-500'">
          <Icon v-if="checked" icon="lucide:check" class="text-[10px] text-white" />
      </div>
      <input type="checkbox" v-model="checked" class="hidden" />
      <div v-if="label || $slots.default" class="text-[11px] text-neutral-400 group-hover:text-neutral-200 transition-colors w-full">
          <slot>{{ label }}</slot>
      </div>
  </label>
</template>

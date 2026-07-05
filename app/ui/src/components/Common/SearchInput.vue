<script setup lang="ts">
/**
 * Standard search input used across the app (sidebar, logs, welcome, …) so every
 * search shares the same theme-aware look: surface bg, themed border/focus, muted
 * placeholder, and an optional inline clear button.
 */
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  modelValue?: string;
  placeholder?: string;
  clearable?: boolean;
}>(), { modelValue: '', clearable: true });

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<template>
  <div class="relative flex items-center w-full">
    <Icon icon="lucide:search" class="absolute left-2.5 text-content-muted text-xs pointer-events-none" />
    <input
      :value="props.modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      type="text"
      spellcheck="false"
      :placeholder="props.placeholder || t('common.search')"
      class="w-full bg-surface border border-line rounded pl-7 pr-7 py-1 text-xs text-content outline-none focus:border-accent transition-colors placeholder:text-content-muted"
    />
    <button
      v-if="props.clearable && props.modelValue"
      @click="emit('update:modelValue', '')"
      class="absolute right-2 text-content-muted hover:text-content-strong transition-colors"
    >
      <Icon icon="lucide:x" class="text-xs" />
    </button>
  </div>
</template>

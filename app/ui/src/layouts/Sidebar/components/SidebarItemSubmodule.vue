<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  id: string;
}>();

const emit = defineEmits(['select']);
</script>

<template>
  <div class="pl-[34px] pr-2 py-1 flex items-center gap-1.5 cursor-pointer text-xs text-content-muted hover:bg-surface-hover transition-colors h-7"
       @click="emit('select', id)">
    <Icon icon="lucide:layers" class="text-content-muted" />
    <span class="truncate flex-1">{{ id }}</span>
  </div>
</template>

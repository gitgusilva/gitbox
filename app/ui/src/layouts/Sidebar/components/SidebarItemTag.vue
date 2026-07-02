<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  item: {
    id: string;
    data: any;
  };
  selectedLogRef: string;
}>();

const emit = defineEmits(['select', 'toggleFilter']);
</script>

<template>
  <div class="pl-[34px] pr-2 py-1 flex items-center gap-1.5 cursor-pointer text-xs text-neutral-400 hover:bg-white/5 transition-colors group/tag h-7"
       @click="emit('select', item.id)">
    <Icon icon="lucide:tag" class="text-neutral-500 group-hover/tag:text-yellow-500 transition-colors" />
    <span class="truncate flex-1 font-mono text-[11px]">{{ item.id }}</span>
    <Icon :icon="selectedLogRef === item.id ? 'lucide:eye' : 'lucide:eye-off'" 
          class="text-neutral-500 hover:text-white flex-shrink-0" 
          :class="selectedLogRef === item.id ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/tag:opacity-50'" 
          @click.stop="emit('toggleFilter', $event, item.id)" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

const props = defineProps<{
  item: {
    id: string;
    data: any;
  };
  selectedLogRefs: string[];
}>();

const emit = defineEmits(['select', 'toggleFilter', 'menu']);

const isFiltered = () => props.selectedLogRefs.includes(props.item.id);
</script>

<template>
  <div class="pl-[34px] pr-2 py-1 flex items-center gap-1.5 cursor-pointer text-xs text-content-muted hover:bg-surface-hover transition-colors group/tag h-7"
       @click="emit('select', item.id)"
       @contextmenu.prevent.stop="emit('menu', $event, item.id)">
    <Icon icon="lucide:tag" class="text-content-muted group-hover/tag:text-yellow-500 transition-colors" />
    <span class="truncate flex-1 font-mono text-[11px]">{{ item.id }}</span>
    <Icon icon="lucide:list-filter"
          class="hover:text-content-strong flex-shrink-0 transition-colors"
          :class="isFiltered() ? 'opacity-100 text-accent' : 'opacity-0 group-hover/tag:opacity-50 text-content-muted'"
          @click.stop="emit('toggleFilter', $event, item.id)" />
  </div>
</template>

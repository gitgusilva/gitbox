<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { GitStatusEntry } from '../../types/git';

const props = defineProps<{
  files: GitStatusEntry[];
  selectedPath?: string;
}>();

const emit = defineEmits(['select']);

function getStatusIcon(status: string) {
  if (status.includes('untracked') || status.includes('new')) return { icon: 'lucide:plus-square', color: 'text-green-500' };
  if (status.includes('deleted')) return { icon: 'lucide:minus-square', color: 'text-red-500' };
  if (status.includes('modified') || status.includes('staged')) return { icon: 'lucide:edit', color: 'text-yellow-500' };
  return { icon: 'lucide:file-text', color: 'text-neutral-500' };
}
</script>

<template>
  <div class="flex flex-col">
    <div v-for="f in files" :key="f.path" 
         @click="emit('select', f.path)"
         class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group"
         :class="selectedPath === f.path ? 'bg-[#143B66] text-white' : 'text-neutral-600 dark:text-neutral-400'">
      <Icon :icon="getStatusIcon(f.status).icon" :class="getStatusIcon(f.status).color" class="text-xs" />
      <span class="text-xs truncate font-mono">{{ f.path }}</span>
    </div>
  </div>
</template>

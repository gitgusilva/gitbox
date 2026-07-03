<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { GitStatusEntry } from '../../types/git';

const props = defineProps<{
  files: GitStatusEntry[];
  selectedPath?: string;
}>();

const emit = defineEmits(['select']);

function getStatusIcon(status: string) {
  if (status.includes('conflicted')) return { icon: 'lucide:alert-triangle', color: 'text-removed' };
  if (status.includes('untracked') || status.includes('new')) return { icon: 'lucide:plus-square', color: 'text-green-500' };
  if (status.includes('deleted')) return { icon: 'lucide:minus-square', color: 'text-red-500' };
  if (status.includes('modified') || status.includes('staged')) return { icon: 'lucide:edit', color: 'text-yellow-500' };
  return { icon: 'lucide:file-text', color: 'text-content-muted' };
}

const isConflicted = (status: string) => status.includes('conflicted');
</script>

<template>
  <div class="flex flex-col">
    <div v-for="f in files" :key="f.path" 
         @click="emit('select', f.path)"
         class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-hover transition-colors group"
         :class="selectedPath === f.path ? 'bg-accent text-accent-fg' : (isConflicted(f.status) ? 'text-removed' : 'text-content-muted')">
      <Icon :icon="getStatusIcon(f.status).icon" :class="selectedPath === f.path ? '' : getStatusIcon(f.status).color" class="text-xs" />
      <span class="text-xs truncate font-mono" :class="{ 'font-semibold': isConflicted(f.status) && selectedPath !== f.path }">{{ f.path }}</span>
    </div>
  </div>
</template>

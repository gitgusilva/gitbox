<script setup lang="ts">
import { PropType } from 'vue';
import { Icon } from '@iconify/vue';
import { startMarquee, stopMarquee } from '../../utils/dom';
import { cn } from '../../utils/cn';

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  status?: string;
  children: Record<string, TreeNode>;
}

defineProps({
  node: { type: Object as PropType<TreeNode>, required: true },
  level: { type: Number, required: true },
  selectedPath: String,
  selectedPaths: Array as PropType<string[]>,
  isDirOpen: { type: Function as PropType<(p: string) => boolean>, required: true }
});

defineEmits(['toggle', 'select', 'dblclick', 'contextmenu']);

function getStatusIcon(status: string) {
  if (!status) return 'lucide:file';
  const s = status.toLowerCase();
  if (s.includes('conflicted')) return 'lucide:alert-triangle';
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'lucide:plus';
  if (s.includes('deleted')) return 'lucide:minus';
  if (s.includes('renamed') || s.includes('moved')) return 'lucide:repeat';
  if (s.includes('modified') || s.includes('staged')) return 'lucide:file-text';
  return 'lucide:file';
}

function getStatusColor(status: string, isSelected: boolean) {
  const s = (status || '').toLowerCase();
  if (s.includes('conflicted')) return 'text-removed';
  if (isSelected) return 'text-accent-fg';
  if (!status) return 'text-content-muted';
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'text-green-500';
  if (s.includes('deleted')) return 'text-red-500';
  if (s.includes('renamed') || s.includes('moved')) return 'text-purple-400';
  if (s.includes('modified') || s.includes('staged')) return 'text-[#E2B93D]';
  return 'text-content-muted';
}

const isConflicted = (status?: string) => (status || '').toLowerCase().includes('conflicted');
</script>

<template>
  <div class="v-stack">
    <div 
      @click="node.isDir ? $emit('toggle', node.fullPath) : $emit('select', node.fullPath, $event)"
      @dblclick="!node.isDir && $emit('dblclick', node.fullPath)"
      @contextmenu.prevent="!node.isDir && $emit('contextmenu', node.fullPath, $event)"
      :class="cn(
        'h-stack gap-1.5 py-1 px-3 cursor-pointer hover:bg-surface-hover transition-colors group overflow-hidden',
        (selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath))) ? 'bg-accent text-accent-fg'
          : (isConflicted(node.status) ? 'text-removed' : 'text-content-muted')
      )"
      :style="{ paddingLeft: (level * 12 + 12) + 'px' }"
      @mouseenter="startMarquee($event, '.truncate')" @mouseleave="stopMarquee($event, '.truncate')"
    >
      <span v-if="node.isDir" class="text-[10px] text-neutral-600 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors">
        <Icon :icon="isDirOpen(node.fullPath) ? 'lucide:chevron-down' : 'lucide:chevron-right'" />
      </span>
      <Icon
        :icon="node.isDir ? (isDirOpen(node.fullPath) ? 'lucide:folder-open' : 'lucide:folder') : getStatusIcon(node.status || '')"
        :class="cn(
          'text-xs shrink-0 marquee-icon',
          node.isDir ? (selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath)) ? 'text-accent-fg' : 'text-accent/50') : getStatusColor(node.status || '', !!(selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath))))
        )"
      />
      <div class="flex-1 min-w-0 overflow-hidden">
        <span :class="cn('text-xs truncate block', (selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath))) ? 'font-bold' : '')">
          {{ node.name }}
        </span>
      </div>
    </div>
    <div v-if="node.isDir && isDirOpen(node.fullPath)">
      <TreeItem v-for="child in Object.values(node.children)" 
                :key="child.fullPath" 
                :node="child" 
                :level="level + 1" 
                :selectedPath="selectedPath"
                :selectedPaths="selectedPaths"
                :isDirOpen="isDirOpen"
                @toggle="p => $emit('toggle', p)"
                @select="(p, e) => $emit('select', p, e)"
                @dblclick="p => $emit('dblclick', p)"
                @contextmenu="(p, e) => $emit('contextmenu', p, e)" />
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'TreeItem'
}
</script>

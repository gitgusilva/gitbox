<script setup lang="ts">
import { PropType } from 'vue';
import { Icon } from '@iconify/vue';

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
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'lucide:plus';
  if (s.includes('deleted')) return 'lucide:minus';
  if (s.includes('renamed') || s.includes('moved')) return 'lucide:repeat';
  if (s.includes('modified') || s.includes('staged')) return 'lucide:file-text';
  return 'lucide:file';
}

function getStatusColor(status: string, isSelected: boolean) {
  if (isSelected) return 'text-white';
  if (!status) return 'text-neutral-500';
  const s = status.toLowerCase();
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'text-green-500';
  if (s.includes('deleted')) return 'text-red-500';
  if (s.includes('renamed') || s.includes('moved')) return 'text-purple-400';
  if (s.includes('modified') || s.includes('staged')) return 'text-[#E2B93D]';
  return 'text-neutral-500';
}
</script>

<template>
  <div class="flex flex-col">
    <div 
      @click="node.isDir ? $emit('toggle', node.fullPath) : $emit('select', node.fullPath, $event)"
      @dblclick="!node.isDir && $emit('dblclick', node.fullPath)"
      @contextmenu.prevent="!node.isDir && $emit('contextmenu', node.fullPath, $event)"
      class="flex items-center gap-1.5 py-1 px-3 cursor-pointer hover:bg-neutral-800 transition-colors group"
      :class="(selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath))) ? 'bg-[#143B66] text-white' : 'text-neutral-400'"
      :style="{ paddingLeft: (level * 12 + 12) + 'px' }"
    >
      <span v-if="node.isDir" class="text-[10px] text-neutral-600 group-hover:text-neutral-400 transition-colors">
        <Icon :icon="isDirOpen(node.fullPath) ? 'lucide:chevron-down' : 'lucide:chevron-right'" />
      </span>
      <Icon 
        :icon="node.isDir ? (isDirOpen(node.fullPath) ? 'lucide:folder-open' : 'lucide:folder') : getStatusIcon(node.status || '')" 
        :class="node.isDir ? (selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath)) ? 'text-white' : 'text-blue-500/50') : getStatusColor(node.status || '', !!(selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath))))"
        class="text-xs shrink-0" 
      />
      <span class="text-xs truncate" :class="{'font-bold': (selectedPath === node.fullPath || (selectedPaths && selectedPaths.includes(node.fullPath)))}">{{ node.name }}</span>
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

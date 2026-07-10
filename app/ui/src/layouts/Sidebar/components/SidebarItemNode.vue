<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { TreeNode } from '../../../utils/tree';

const props = defineProps<{
  node: TreeNode;
  section: string;
  selectedLogRefs: string[];
  expandedGroups: Record<string, boolean>;
}>();

/** Whether this branch/tag is part of the active history filter set. */
const isFiltered = () => props.selectedLogRefs.includes(props.node.fullPath);

const emit = defineEmits(['toggleGroup', 'selectLog', 'checkout', 'menu', 'toggleFilter']);
</script>

<template>
  <div class="py-1 flex items-center gap-1.5 cursor-pointer text-xs group/item pr-2 h-7"
       :class="[
         !node.isGroup && node.data?.is_head
           ? 'font-bold text-content-strong'
           : (isFiltered() ? 'text-content-strong' : 'text-content-muted'),
         isFiltered() ? 'bg-accent/20' : 'hover:bg-surface-hover'
       ]"
       :style="{ paddingLeft: `${(node.level + 1) * 12 + 10}px` }"
       @click="node.isGroup ? emit('toggleGroup', node.fullPath) : emit('selectLog', node.fullPath)"
       @dblclick="!node.isGroup ? emit('checkout', node.fullPath) : null"
       @contextmenu.prevent="(!node.isGroup || (section === 'remotes' && node.level === 0)) ? emit('menu', $event, node.fullPath) : null">
    <Icon v-if="node.isGroup" :icon="node.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="text-[10px]" />
    <Icon :icon="node.isGroup ? (section === 'remotes' && node.level === 0 ? 'lucide:cloud' : 'lucide:folder') : 'lucide:git-branch'" :class="node.data?.is_head ? 'text-green-500' : 'text-content-muted'" />
    <span class="truncate flex-1">{{ node.displayName }}</span>
    
    <div v-if="!node.isGroup && (node.data?.ahead || node.data?.behind)" class="flex gap-1 text-[9px] font-mono mr-1">
      <span v-if="node.data?.behind" class="text-accent">↓{{ node.data.behind }}</span>
      <span v-if="node.data?.ahead" class="text-green-400">↑{{ node.data.ahead }}</span>
    </div>
    
    <Icon v-if="!node.isGroup"
          icon="lucide:list-filter"
          :title="isFiltered() ? 'Remove from history filter' : 'Filter history to this branch'"
          class="hover:text-content-strong flex-shrink-0 transition-colors"
          :class="isFiltered() ? 'opacity-100 text-accent' : 'opacity-0 group-hover/item:opacity-50 text-content-muted'"
          @click.stop="emit('toggleFilter', $event, node.fullPath)" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { TreeNode } from '../../../utils/tree';

defineProps<{
  node: TreeNode;
  section: string;
  selectedLogRef: string;
  expandedGroups: Record<string, boolean>;
}>();

const emit = defineEmits(['toggleGroup', 'selectLog', 'checkout', 'menu', 'toggleFilter']);
</script>

<template>
  <div class="py-1 flex items-center gap-1.5 cursor-pointer text-xs group/item pr-2 h-7"
       :class="[!node.isGroup && node.data?.is_head ? 'font-bold text-content-strong' : 'text-content-muted', selectedLogRef === node.name ? 'bg-accent/20' : 'hover:bg-black/5 dark:hover:bg-white/5']"
       :style="{ paddingLeft: `${(node.level + 1) * 12 + 10}px` }"
       @click="node.isGroup ? emit('toggleGroup', node.fullPath) : emit('selectLog', node.fullPath)"
       @dblclick="!node.isGroup ? emit('checkout', node.fullPath) : null"
       @contextmenu.prevent="!node.isGroup ? emit('menu', $event, node.fullPath) : null">
    <Icon v-if="node.isGroup" :icon="node.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="text-[10px]" />
    <Icon :icon="node.isGroup ? (section === 'remotes' && node.level === 0 ? 'lucide:cloud' : 'lucide:folder') : 'lucide:git-branch'" :class="node.data?.is_head ? 'text-green-500' : 'text-neutral-500'" />
    <span class="truncate flex-1">{{ node.displayName }}</span>
    
    <div v-if="!node.isGroup && (node.data?.ahead || node.data?.behind)" class="flex gap-1 text-[9px] font-mono mr-1">
      <span v-if="node.data?.behind" class="text-accent">↓{{ node.data.behind }}</span>
      <span v-if="node.data?.ahead" class="text-green-400">↑{{ node.data.ahead }}</span>
    </div>
    
    <Icon v-if="!node.isGroup" 
          :icon="selectedLogRef === node.name ? 'lucide:eye' : 'lucide:eye-off'" 
          class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex-shrink-0"
          :class="selectedLogRef === node.name ? 'opacity-100 text-accent' : 'opacity-0 group-hover/item:opacity-50'"
          @click.stop="emit('toggleFilter', $event, node.name)" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { isPRLoading } from '../../../services/pullRequestService';

defineProps<{
  item: {
    id: string;
    label: string;
    count: number;
    collapsed: boolean;
  };
  hasActivePRProvider?: boolean;
}>();

const emit = defineEmits(['toggle', 'refreshPRs', 'createPR']);
</script>

<template>
  <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer hover:bg-white/5 transition-colors group h-7"
       @click="emit('toggle', item.id)">
    <Icon :icon="item.collapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" class="text-[10px]" />
    <Icon :icon="item.id === 'local' ? 'lucide:monitor' : (item.id === 'remotes' ? 'lucide:cloud' : (item.id === 'tags' ? 'lucide:tag' : (item.id === 'pull_requests' ? 'lucide:git-pull-request' : 'lucide:layers')))" class="text-sm" />
    <span class="flex-1 truncate">{{ item.label }} ({{ item.count }})</span>
    
    <div v-if="item.id === 'pull_requests' && hasActivePRProvider" class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
      <button @click.stop="emit('refreshPRs')" class="p-1 hover:bg-neutral-700 rounded transition-colors group/btn">
        <Icon icon="lucide:rotate-cw" :class="{'animate-spin text-accent': isPRLoading}" class="text-[10px]" />
      </button>
      <button @click.stop="emit('createPR')" class="p-1 hover:bg-neutral-700 rounded transition-colors group/btn ml-1">
        <Icon icon="lucide:plus" class="text-[10px] group-hover/btn:text-accent" />
      </button>
    </div>
  </div>
</template>

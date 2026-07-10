<script setup lang="ts">
import { Icon } from '@iconify/vue';

defineProps<{
  pr: any;
}>();

const emit = defineEmits(['open']);
</script>

<template>
  <div class="pl-[34px] pr-2 py-1.5 flex flex-col gap-0.5 hover:bg-surface-hover cursor-pointer group/pr border-l-2 border-transparent hover:border-accent transition-all h-[52px]"
       @click="emit('open', pr)">
     <div class="flex items-start gap-2">
       <Icon :icon="pr.state === 'open' ? 'lucide:git-pull-request' : 'lucide:git-pull-request-closed'" 
             :class="pr.state === 'open' ? 'text-green-500' : 'text-purple-500'" 
             class="text-xs mt-0.5" />
       <div class="flex-1 min-w-0">
         <div class="text-[11px] text-content font-medium truncate group-hover/pr:text-accent transition-colors">
           <span class="text-content-muted font-mono">#{{ pr.number }}</span> {{ pr.title }}
         </div>
         <div class="flex items-center gap-1.5 mt-0.5">
           <img :src="pr.user.avatar_url" class="w-3 h-3 rounded-full opacity-80" />
           <span class="text-[9px] text-content-muted font-medium">{{ pr.user.login }}</span>
           <span class="text-[9px] text-content-muted flex items-center gap-1">
             <Icon icon="lucide:arrow-right" class="text-[8px]" />
             {{ pr.targetBranch }}
           </span>
         </div>
       </div>
     </div>
  </div>
</template>

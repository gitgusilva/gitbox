<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { submodules } from '../../../services/gitService';
import { contextMenu, requestConfirm } from '../../../services/modalService';

const props = defineProps<{
  branchFilter: string;
}>();

const { t } = useI18n();

const isCollapsed = ref(false);

const filteredSubmodules = computed(() => {
    let result = submodules.value;
    if (props.branchFilter) {
        const filter = props.branchFilter.toLowerCase();
        result = result.filter(m => m.path.toLowerCase().includes(filter));
    }
    return result;
});

function openSubmoduleContextMenu(e: MouseEvent, index: number, sub: any) {
    e.preventDefault();
    contextMenu.value = {
        x: e.clientX,
        y: e.clientY,
        items: [
            { label: 'Copy Path', icon: 'lucide:copy', action: () => navigator.clipboard.writeText(sub.path) },
            { label: 'Copy SHA', icon: 'lucide:copy', action: () => navigator.clipboard.writeText(sub.sha) }
        ]
    };
}
</script>

<template>
  <div v-if="filteredSubmodules.length > 0" class="flex flex-col select-none">
     <button class="flex items-center gap-1.5 px-3 py-1.5 w-full hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors group" @click="isCollapsed = !isCollapsed">
        <Icon :icon="isCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" class="text-xs transition-transform" />
        <span class="font-bold text-xs tracking-tight">SUBMODULES</span>
        <span class="bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700 text-[10px] px-1.5 rounded-full ml-auto">{{ filteredSubmodules.length }}</span>
     </button>
     
     <ul v-show="!isCollapsed" class="flex flex-col py-1">
        <li v-for="(sub, i) in filteredSubmodules" :key="sub.path" 
            @contextmenu="openSubmoduleContextMenu($event, i, sub)"
            class="pl-[26px] pr-2 py-1 flex items-center gap-2 hover:bg-neutral-800 cursor-pointer group/sub relative transition-all text-neutral-300 hover:text-white">
            
            <Icon icon="lucide:package" class="text-xs flex-shrink-0" :class="{'text-yellow-500': sub.status === 'uninitialized', 'text-blue-500': sub.status === 'modified'}" />
            <span class="text-xs truncate flex-1 font-mono leading-tight whitespace-nowrap">{{ sub.path }}</span>
            
            <!-- Quick Action Buttons -->
            <div class="hidden group-hover/sub:flex items-center gap-1 absolute right-2 bg-gradient-to-l from-neutral-800 via-neutral-800 pl-4 py-0.5">
               <button class="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white transition-colors" title="Open terminal" @click.stop="">
                  <Icon icon="lucide:terminal" class="text-[10px]" />
               </button>
            </div>
            
            <div class="absolute inset-y-0 left-0 w-[2px] bg-transparent transition-colors group-hover/sub:bg-blue-500"></div>
        </li>
     </ul>
  </div>
</template>

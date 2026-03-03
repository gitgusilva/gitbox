<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { tags, selectedLogRef, activeTab, selectedCommit, loadRepoData, log } from '../../../services/gitService';
import { contextMenu } from '../../../services/modalService';

const props = defineProps<{
  branchFilter: string;
}>();

const { t } = useI18n();

const tagsCollapsed = ref(true);

const displayTags = computed(() => tags.value.filter(tag => {
  const name = typeof tag === 'string' ? tag : tag.name;
  return name && name.toLowerCase().includes(props.branchFilter.toLowerCase());
}));

function selectTagLog(tagData: any) {
  const target = typeof tagData === 'string' ? null : tagData.target;
  const name = typeof tagData === 'string' ? tagData : tagData.name;

  if (target) {
     activeTab.value = 'history';
     const commit = log.value.find(c => c.id === target);

     if (commit) {
        selectedCommit.value = commit;
        setTimeout(() => {
            const el = document.getElementById(`commit-${commit.id}`);
            if (el) {
               el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    } else {
        selectedLogRef.value = name;
        loadRepoData();
     }
  } else {
      selectedLogRef.value = name;
      activeTab.value = 'history';
      loadRepoData();
  }
}

function toggleFilterTag(e: Event, tagData: any) {
  e.stopPropagation();
  const name = typeof tagData === 'string' ? tagData : tagData.name;

  if (selectedLogRef.value === name) {
    selectedLogRef.value = '';
  } else {
    selectedLogRef.value = name;
  }

  loadRepoData();
}

function showTagMenu(e: MouseEvent, tagData: any) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
       { label: t('common.history'), action: () => selectTagLog(tagData), icon: 'lucide:tag' }
    ]
  }
}

</script>

<template>
  <div class="mb-2">
     <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer hover:text-neutral-300 select-none" @click="tagsCollapsed = !tagsCollapsed">
       <Icon :icon="tagsCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
       <Icon icon="lucide:tag" class="text-sm" /> <span>{{ t('common.tags') }} ({{ displayTags.length }})</span>
     </div>
     <ul v-show="!tagsCollapsed" class="pb-1">
       <li v-for="tagData in displayTags" :key="typeof tagData === 'string' ? tagData : tagData.name" 
           class="px-6 py-1 flex items-center gap-2 hover:bg-neutral-800 cursor-pointer text-xs text-neutral-400 group/item" 
           :class="selectedLogRef === (typeof tagData === 'string' ? tagData : tagData.name) ? 'bg-neutral-800' : ''"
           @click="selectTagLog(tagData)"
           @contextmenu.prevent="showTagMenu($event, tagData)">
         <Icon icon="lucide:tag" class="text-neutral-500" /> <span class="truncate flex-1">{{ typeof tagData === 'string' ? tagData : tagData.name }}</span>
         <Icon :icon="selectedLogRef === (typeof tagData === 'string' ? tagData : tagData.name) ? 'lucide:eye' : 'lucide:eye-off'" class="mr-2 text-neutral-500 hover:text-white" :class="selectedLogRef === (typeof tagData === 'string' ? tagData : tagData.name) ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/item:opacity-50'" @click.stop="toggleFilterTag($event, tagData)" title="Toggle log filter" />
       </li>
     </ul>
  </div>
</template>

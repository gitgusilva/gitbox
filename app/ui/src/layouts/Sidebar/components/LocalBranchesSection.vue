<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { branches, selectedLogRef, activeTab, selectedCommit, loadRepoData, log, checkoutBranch, deleteBranch } from '../../../services/gitService';
import { Branch } from '../../../types/git';
import { contextMenu, requestConfirm } from '../../../services/modalService';

const props = defineProps<{
  branchFilter: string;
}>();

const { t } = useI18n();

const localBranchesCollapsed = ref(true);
const branchSortOrder = ref<'name' | 'date'>('name');
const expandedGroups = ref<Record<string, boolean>>({});

const localBranches = computed(() => branches.value.filter(b => !b.is_remote && b.name.toLowerCase().includes(props.branchFilter.toLowerCase())));

function toggleGroup(groupName: string) {
  expandedGroups.value[groupName] = expandedGroups.value[groupName] === false ? true : false;
}

function selectBranchLog(name: string) {
  selectedLogRef.value = name;
  activeTab.value = 'history';

  const branch = branches.value.find(b => b.name === name);

  if (branch && branch.target) {
     const commit = log.value.find(c => c.id === branch.target);
     if (commit) {
        selectedCommit.value = commit;
        setTimeout(() => {
            const el = document.getElementById(`commit-${commit.id}`);
            if (el) {
               el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
        return;
     }
  }

  loadRepoData();
}

function toggleFilter(e: Event, name: string) {
  e.stopPropagation();

  if (selectedLogRef.value === name) {
    selectedLogRef.value = '';
  } else {
    selectedLogRef.value = name;
  }

  loadRepoData();
}

function showBranchMenu(e: MouseEvent, branchName: string) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('common.checkout'), action: () => checkoutBranch(branchName), icon: 'lucide:git-compare' },
      { separator: true },
      { label: t('common.history'), action: () => selectBranchLog(branchName), icon: 'lucide:history' },
      { separator: true },
      { label: t('common.delete'), action: () => requestConfirm(t('common.delete_branch'), `Are you sure you want to delete branch ${branchName}?`, true, () => deleteBranch(branchName)), icon: 'lucide:trash-2', danger: true },
    ]
  };
}

function buildFlatTree(branchList: Branch[]) {
  type Node = { isGroup: boolean; name: string; displayName: string; children: Node[]; count: number; branch?: Branch };
  const root: Node[] = [];
  
  for (const b of branchList) {
    const parts = b.name.split('/');
    let currentLevel = root;
    let fullPath = '';
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        fullPath += (i === 0 ? part : '/' + part);
        
        if (i === parts.length - 1) {
            currentLevel.push({ name: b.name, displayName: part, isGroup: false, children: [], count: 1, branch: b });
        } else {
            let existingGroup = currentLevel.find(n => n.isGroup && n.name === fullPath);
            if (!existingGroup) {
                existingGroup = { name: fullPath, displayName: part, isGroup: true, children: [], count: 0 };
                currentLevel.push(existingGroup);
            }
            currentLevel = existingGroup.children;
        }
    }
  }

  function calcCountAndSort(nodes: Node[]) {
    for (const n of nodes) {
      if (n.isGroup) {
        calcCountAndSort(n.children);
        n.count = n.children.reduce((acc, c) => acc + c.count, 0);
      }
    }
    nodes.sort((a, b) => {
      if (a.isGroup !== b.isGroup) return a.isGroup ? -1 : 1;
      if (branchSortOrder.value === 'date' && !a.isGroup && !b.isGroup) {
         const tA = a.branch?.timestamp || 0;
         const tB = b.branch?.timestamp || 0;
         if (tA !== tB) return tB - tA;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }
  calcCountAndSort(root);

  const flat: any[] = [];
  function flatten(nodes: Node[], level: number) {
    for (const n of nodes) {
      flat.push({ ...n, level });
      if (n.isGroup && expandedGroups.value[n.name] !== false) {
        flatten(n.children, level + 1);
      }
    }
  }
  flatten(root, 0);
  return flat;
}

const groupedLocalBranches = computed(() => buildFlatTree(localBranches.value));
</script>

<template>
  <div class="mb-2">
     <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer select-none group">
       <div class="flex items-center gap-1.5 flex-1" @click="localBranchesCollapsed = !localBranchesCollapsed">
         <Icon :icon="localBranchesCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
         <Icon icon="lucide:monitor" /> <span>{{ t('common.local') }} ({{ localBranches.length }})</span>
       </div>
       <Icon :icon="branchSortOrder === 'name' ? 'lucide:arrow-down-a-z' : 'lucide:clock'" 
             @click.stop="branchSortOrder = branchSortOrder === 'name' ? 'date' : 'name'" 
             class="text-sm opacity-0 group-hover:opacity-100 cursor-pointer" />
     </div>
     <ul v-show="!localBranchesCollapsed">
       <li v-for="node in groupedLocalBranches" :key="node.name" 
           class="py-1 flex items-center gap-1.5 cursor-pointer text-xs group/item" 
           :class="[!node.isGroup && node.branch?.is_head ? 'font-bold text-white' : 'text-neutral-400', selectedLogRef === node.name ? 'bg-neutral-800' : '']" 
           :style="{ paddingLeft: `${(node.level + 1) * 12 + 10}px` }" 
           @click="node.isGroup ? toggleGroup(node.name) : selectBranchLog(node.name)" 
           @dblclick="!node.isGroup ? checkoutBranch(node.name) : null"
           @contextmenu.prevent="!node.isGroup ? showBranchMenu($event, node.name) : null">
         <Icon v-if="node.isGroup" :icon="expandedGroups[node.name] !== false ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="text-[10px]" />
         <Icon :icon="node.isGroup ? 'lucide:folder' : 'lucide:git-branch'" :class="node.branch?.is_head ? 'text-green-500' : 'text-neutral-500'" />
         <span class="truncate flex-1">{{ node.displayName }}</span>
         <div v-if="!node.isGroup && (node.branch?.ahead || node.branch?.behind)" class="flex gap-1 text-[9px] font-mono mr-1">
           <span v-if="node.branch?.behind" class="text-blue-400">↓{{ node.branch.behind }}</span>
           <span v-if="node.branch?.ahead" class="text-green-400">↑{{ node.branch.ahead }}</span>
         </div>
         <Icon v-if="!node.isGroup" :icon="selectedLogRef === node.name ? 'lucide:eye' : 'lucide:eye-off'" class="mr-2 text-neutral-500 hover:text-white flex-shrink-0" :class="selectedLogRef === node.name ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/item:opacity-50'" @click.stop="toggleFilter($event, node.name)" title="Toggle log filter" />
       </li>
     </ul>
  </div>
</template>

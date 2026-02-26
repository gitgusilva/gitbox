<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { 
  branches, 
  activeTab, 
  status, 
  stashes,
  selectedLogRef,
  checkoutBranch,
  loadRepoData,
  log,
  selectedCommit
} from '../../services/gitService';
import { sidebarWidth, startResize } from '../../services/layoutService';
import { Branch } from '../../types/git';

const { t } = useI18n();

const localBranchesCollapsed = ref(true);
const remotesCollapsed = ref(true);
const tagsCollapsed = ref(true);
const branchFilter = ref('');
const branchSortOrder = ref<'name' | 'date'>('name');
const expandedGroups = ref<Record<string, boolean>>({});

const localBranches = computed(() => branches.value.filter(b => !b.is_remote && b.name.toLowerCase().includes(branchFilter.value.toLowerCase())));
const filteredRemotes = computed(() => branches.value.filter(b => b.is_remote && b.is_remote).map(b => b.name.split('/')[0]).filter((v, i, a) => a.indexOf(v) === i)); // Just unique remote names for the top level usually, but here we use the existing filtered logic
const filteredTags = computed(() => branches.value.filter(b => false)); // Tags are separate in gitService, let's fix that

// Actually, let's look at gitService again. remotes and tags are separate refs.
import { remotes, tags } from '../../services/gitService';

const displayRemotes = computed(() => remotes.value.filter(r => r.toLowerCase().includes(branchFilter.value.toLowerCase())));
const displayTags = computed(() => tags.value.filter(t => {
  const name = typeof t === 'string' ? t : t.name;
  return name && name.toLowerCase().includes(branchFilter.value.toLowerCase());
}));

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

function selectTagLog(t: any) {
  const target = typeof t === 'string' ? null : t.target;
  const name = typeof t === 'string' ? t : t.name;

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

function toggleFilter(e: Event, name: string) {
  e.stopPropagation();
  if (selectedLogRef.value === name) {
    selectedLogRef.value = '';
  } else {
    selectedLogRef.value = name;
  }
  loadRepoData();
}

function toggleFilterTag(e: Event, t: any) {
  e.stopPropagation();
  const name = typeof t === 'string' ? t : t.name;
  if (selectedLogRef.value === name) {
    selectedLogRef.value = '';
  } else {
    selectedLogRef.value = name;
  }
  loadRepoData();
}

import { contextMenu } from '../../services/modalService';

function showBranchMenu(e: MouseEvent, branchName: string) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('common.checkout'), action: () => checkoutBranch(branchName), icon: 'lucide:git-compare' },
      { separator: true },
      { label: t('common.history'), action: () => selectBranchLog(branchName), icon: 'lucide:history' }
    ]
  };
}

function showRemoteMenu(e: MouseEvent, remoteName: string) {
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
      { label: t('common.history'), action: () => selectBranchLog(remoteName), icon: 'lucide:history' }
    ]
  };
}

function showTagMenu(e: MouseEvent, t: any) {
  const name = typeof t === 'string' ? t : t.name;
  contextMenu.value = {
    x: e.clientX,
    y: e.clientY,
    items: [
       { label: t('common.history'), action: () => selectTagLog(t), icon: 'lucide:tag' }
    ]
  }
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
const groupedRemoteBranches = computed(() => {
  const bList = branches.value.filter(b => b.is_remote && b.name.toLowerCase().includes(branchFilter.value.toLowerCase()));
  return buildFlatTree(bList);
});
</script>

<template>
  <aside class="flex flex-col border-r border-neutral-800 bg-[#1E1E1E] flex-shrink-0 relative select-none" :style="{ width: sidebarWidth + 'px' }">
    <div class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 transition-colors" @mousedown="startResize('sidebar', $event)"></div>
    
    <!-- Tab buttons -->
    <div class="flex flex-col py-2 border-b border-neutral-800">
      <button class="px-3 h-8 flex items-center justify-between hover:bg-neutral-800" 
              :class="activeTab === 'history' ? 'bg-[#37373D] text-white' : ''" 
              @click="activeTab = 'history'">
        <span class="font-bold text-xs flex items-center gap-1.5"><Icon icon="lucide:history" /> {{ t('common.history') }}</span>
      </button>
      <button class="px-3 h-8 flex items-center justify-between hover:bg-neutral-800" 
              :class="activeTab === 'local_changes' ? 'bg-[#37373D] text-white' : ''" 
              @click="activeTab = 'local_changes'">
        <span class="font-bold text-xs flex items-center gap-1.5"><Icon icon="lucide:file-edit" /> {{ t('common.local_changes') }}</span>
        <span class="bg-neutral-700 text-[10px] px-1.5 rounded-full" v-if="status.length">{{ status.length }}</span>
      </button>
      <button class="px-3 h-8 flex items-center justify-between hover:bg-neutral-800" 
              :class="activeTab === 'stashes' ? 'bg-[#37373D] text-white' : ''" 
              @click="activeTab = 'stashes'">
        <span class="font-bold text-xs flex items-center gap-1.5"><Icon icon="lucide:layers" /> {{ t('common.stashes') }}</span>
        <span class="bg-neutral-700 text-[10px] px-1.5 rounded-full" v-if="stashes.length">{{ stashes.length }}</span>
      </button>
    </div>
    
    <!-- Lists -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="p-2 border-b border-neutral-800">
        <div class="relative flex items-center">
          <Icon icon="lucide:search" class="absolute left-2 text-neutral-500 text-xs" />
          <input v-model="branchFilter" class="w-full bg-[#252526] border border-neutral-800 pl-6 pr-2 py-1 text-xs text-neutral-300 outline-none rounded focus:border-neutral-500" :placeholder="t('common.search')" />
        </div>
      </div>
      
      <div class="flex-1 mt-2 pb-4 overflow-y-auto overflow-x-hidden">
        <!-- Local Branches -->
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

        <!-- Remotes -->
        <div class="mb-2">
           <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer select-none group">
             <div class="flex items-center gap-1.5 flex-1 hover:text-neutral-300" @click="remotesCollapsed = !remotesCollapsed">
               <Icon :icon="remotesCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
               <Icon icon="lucide:cloud" class="text-sm" /> <span>{{ t('common.remotes') }} ({{ displayRemotes.length }})</span>
             </div>
           </div>
           <ul v-show="!remotesCollapsed" class="pb-1">
             <li v-for="node in groupedRemoteBranches" :key="node.name" 
                 class="py-1 flex items-center gap-1.5 cursor-pointer text-xs group/item" 
                 :class="[node.isGroup ? 'text-neutral-300' : 'text-neutral-400', selectedLogRef === node.name ? 'bg-neutral-800' : '']" 
                 :style="{ paddingLeft: `${(node.level + 1) * 12 + 10}px` }" 
                 @click="node.isGroup ? toggleGroup(node.name) : selectBranchLog(node.name)"
                 @contextmenu.prevent="!node.isGroup ? showRemoteMenu($event, node.name) : null">
               <Icon v-if="node.isGroup" :icon="expandedGroups[node.name] !== false ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="text-[10px]" />
               <Icon :icon="node.isGroup ? (node.level === 0 ? 'lucide:cloud' : 'lucide:folder') : 'lucide:git-branch'" class="text-neutral-500" />
               <span class="truncate flex-1">{{ node.displayName }}</span>
               <Icon v-if="!node.isGroup" :icon="selectedLogRef === node.name ? 'lucide:eye' : 'lucide:eye-off'" class="mr-2 text-neutral-500 hover:text-white" :class="selectedLogRef === node.name ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/item:opacity-50'" @click.stop="toggleFilter($event, node.name)" title="Toggle log filter" />
             </li>
           </ul>
        </div>

        <!-- Tags -->
        <div class="mb-2">
           <div class="px-2 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-500 cursor-pointer hover:text-neutral-300 select-none" @click="tagsCollapsed = !tagsCollapsed">
             <Icon :icon="tagsCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
             <Icon icon="lucide:tag" class="text-sm" /> <span>{{ t('common.tags') }} ({{ displayTags.length }})</span>
           </div>
           <ul v-show="!tagsCollapsed" class="pb-1">
             <li v-for="t in displayTags" :key="typeof t === 'string' ? t : t.name" 
                 class="px-6 py-1 flex items-center gap-2 hover:bg-neutral-800 cursor-pointer text-xs text-neutral-400 group/item" 
                 :class="selectedLogRef === (typeof t === 'string' ? t : t.name) ? 'bg-neutral-800' : ''"
                 @click="selectTagLog(t)"
                 @contextmenu.prevent="showTagMenu($event, t)">
               <Icon icon="lucide:tag" class="text-neutral-500" /> <span class="truncate flex-1">{{ typeof t === 'string' ? t : t.name }}</span>
               <Icon :icon="selectedLogRef === (typeof t === 'string' ? t : t.name) ? 'lucide:eye' : 'lucide:eye-off'" class="mr-2 text-neutral-500 hover:text-white" :class="selectedLogRef === (typeof t === 'string' ? t : t.name) ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover/item:opacity-50'" @click.stop="toggleFilterTag($event, t)" title="Toggle log filter" />
             </li>
           </ul>
        </div>
      </div>
    </div>
  </aside>
</template>

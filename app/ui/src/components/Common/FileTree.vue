<script setup lang="ts">
import { ref, computed } from 'vue';
import TreeItem from './TreeItem.vue';

interface FileNode {
  path: string;
  status: string;
}

const props = defineProps<{
  files: FileNode[];
  selectedPath?: string;
  selectedPaths?: string[];
  viewMode?: string;
}>();

const emit = defineEmits(['select', 'dblclick', 'contextmenu']);

interface TreeNode {
  name: string;
  fullPath: string;
  isDir: boolean;
  status?: string;
  children: Record<string, TreeNode>;
}

const tree = computed(() => {
  const root: TreeNode = { name: 'root', fullPath: '', isDir: true, children: {} };
  props.files.forEach(f => {
    const parts = f.path.split('/');
    let current = root;
    let currentPath = '';
    parts.forEach((part, i) => {
      currentPath += (i === 0 ? '' : '/') + part;
      if (i === parts.length - 1) {
        current.children[part] = { name: part, fullPath: f.path, isDir: false, status: f.status, children: {} };
      } else {
        if (!current.children[part]) {
          current.children[part] = { name: part, fullPath: currentPath, isDir: true, children: {} };
        }
        current = current.children[part];
      }
    });
  });
  
  const sortNodes = (node: TreeNode) => {
    const childrenValues = Object.values(node.children);
    childrenValues.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const sorted: Record<string, TreeNode> = {};
    childrenValues.forEach(c => {
      sorted[c.name] = c;
      if (c.isDir) sortNodes(c);
    });
    node.children = sorted;
  };
  
  sortNodes(root);
  return root;
});

const toggledDirs = ref<Record<string, boolean>>({});

function toggleDir(path: string) {
  toggledDirs.value[path] = toggledDirs.value[path] === undefined ? false : !toggledDirs.value[path];
}

function isDirOpen(path: string) {
  return toggledDirs.value[path] !== false;
}

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
  <div class="flex flex-col py-1 select-none">
    <div v-if="files.length === 0" class="px-4 py-8 text-center text-xs text-neutral-600 italic uppercase tracking-widest font-bold">
      No files changed
    </div>
    <div v-else class="flex flex-col">
      <!-- Tree View -->
      <template v-if="!viewMode || viewMode === 'tree'">
        <TreeItem v-for="node in Object.values(tree.children)" 
                  :key="node.fullPath" 
                  :node="node" 
                  :level="0" 
                  :selectedPath="selectedPath"
                  :selectedPaths="selectedPaths"
                  :isDirOpen="isDirOpen"
                  @toggle="toggleDir"
                  @select="(p, e) => emit('select', p, e)"
                  @dblclick="p => emit('dblclick', p)"
                  @contextmenu="(p, e) => emit('contextmenu', p, e)" />
      </template>

      <!-- List or Flat View -->
      <template v-else>
        <div v-for="f in files" :key="f.path"
             @click="emit('select', f.path, $event)"
             @dblclick="emit('dblclick', f.path)"
             @contextmenu.prevent="emit('contextmenu', f.path, $event)"
             class="flex items-center gap-1.5 py-1 px-3 cursor-pointer hover:bg-neutral-800 transition-colors group"
             :class="(selectedPath === f.path || (selectedPaths && selectedPaths.includes(f.path))) ? 'bg-[#143B66] text-white' : 'text-neutral-400'">
          
          <Icon :icon="getStatusIcon(f.status)" :class="getStatusColor(f.status, !!(selectedPath === f.path || (selectedPaths && selectedPaths.includes(f.path))))" class="text-xs shrink-0" />
          
          <div v-if="viewMode === 'list'" class="text-xs truncate flex-1 min-w-0" :class="{'font-bold': selectedPath === f.path || (selectedPaths && selectedPaths.includes(f.path))}">
            {{ f.path }}
          </div>
          
          <div v-else class="text-xs truncate flex-1 min-w-0 flex items-baseline gap-2" :class="{'font-bold': selectedPath === f.path || (selectedPaths && selectedPaths.includes(f.path))}">
            <span class="shrink-0">{{ f.path.split('/').pop() }}</span>
            <span class="text-[10px] opacity-40 truncate">{{ f.path.split('/').slice(0, -1).join('/') }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

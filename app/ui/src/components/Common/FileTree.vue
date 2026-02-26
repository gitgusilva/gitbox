<script setup lang="ts">
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';

interface FileNode {
  path: string;
  status: string;
}

const props = defineProps<{
  files: FileNode[];
  selectedPath?: string;
}>();

const emit = defineEmits(['select']);

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
  return root;
});

const toggledDirs = ref<Record<string, boolean>>({});

function toggleDir(path: string) {
  toggledDirs.value[path] = toggledDirs.value[path] === undefined ? false : !toggledDirs.value[path];
}

function isDirOpen(path: string) {
  return toggledDirs.value[path] !== false;
}

function getStatusColor(status?: string) {
  if (!status) return 'text-neutral-500';
  if (status.includes('untracked') || status.includes('added') || status.includes('new')) return 'text-green-500';
  if (status.includes('deleted')) return 'text-red-500';
  if (status.includes('modified') || status.includes('staged')) return 'text-yellow-500';
  return 'text-neutral-500';
}
</script>

<template>
  <div class="flex flex-col py-1 select-none">
    <div v-if="files.length === 0" class="px-4 py-8 text-center text-xs text-neutral-600 italic uppercase tracking-widest font-bold">
      No files changed
    </div>
    <div v-else class="flex flex-col">
      <TreeItem v-for="node in Object.values(tree.children)" 
                :key="node.fullPath" 
                :node="node" 
                :level="0" 
                :selectedPath="selectedPath"
                :isDirOpen="isDirOpen"
                @toggle="toggleDir"
                @select="p => emit('select', p)" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';

const TreeItem = defineComponent({
  name: 'TreeItem',
  props: {
    node: { type: Object as PropType<any>, required: true },
    level: { type: Number, required: true },
    selectedPath: String,
    isDirOpen: { type: Function as PropType<(p: string) => boolean>, required: true }
  },
  emits: ['toggle', 'select'],
  template: `
    <div class="flex flex-col">
      <div 
        @click="node.isDir ? $emit('toggle', node.fullPath) : $emit('select', node.fullPath)"
        class="flex items-center gap-1.5 py-1 px-3 cursor-pointer hover:bg-neutral-800 transition-colors group"
        :class="selectedPath === node.fullPath ? 'bg-[#143B66] text-white' : 'text-neutral-400'"
        :style="{ paddingLeft: (level * 12 + 12) + 'px' }"
      >
        <span v-if="node.isDir" class="text-[10px] text-neutral-600 group-hover:text-neutral-400 transition-colors">
          <Icon :icon="isDirOpen(node.fullPath) ? 'lucide:chevron-down' : 'lucide:chevron-right'" />
        </span>
        <Icon 
          :icon="node.isDir ? (isDirOpen(node.fullPath) ? 'lucide:folder-open' : 'lucide:folder') : getStatusIcon(node.status)" 
          :class="node.isDir ? 'text-blue-500/50' : getStatusColor(node.status)"
          class="text-xs" 
        />
        <span class="text-xs truncate" :class="{'font-bold': selectedPath === node.fullPath}">{{ node.name }}</span>
      </div>
      <div v-if="node.isDir && isDirOpen(node.fullPath)">
        <TreeItem v-for="child in Object.values(node.children)" 
                  :key="child.fullPath" 
                  :node="child" 
                  :level="level + 1" 
                  :selectedPath="selectedPath"
                  :isDirOpen="isDirOpen"
                  @toggle="p => $emit('toggle', p)"
                  @select="p => $emit('select', p)" />
      </div>
    </div>
  `,
  methods: {
    getStatusIcon(status: string) {
      if (status.includes('untracked') || status.includes('added') || status.includes('new')) return 'lucide:plus';
      if (status.includes('deleted')) return 'lucide:minus';
      return 'lucide:file';
    },
    getStatusColor(status?: string) {
      if (!status) return 'text-neutral-500';
      if (status.includes('untracked') || status.includes('added') || status.includes('new')) return 'text-green-500';
      if (status.includes('deleted')) return 'text-red-500';
      if (status.includes('modified') || status.includes('staged')) return 'text-yellow-500';
      return 'text-neutral-500';
    }
  }
});
</script>

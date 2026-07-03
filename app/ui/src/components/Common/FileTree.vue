<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { startMarquee, stopMarquee } from '../../utils/dom';
import { cn } from '../../utils/cn';
import VirtualScroll from './VirtualScroll.vue';

const { t } = useI18n();

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
  children: { [key: string]: TreeNode };
}

const tree = computed(() => {
  const root: TreeNode = { name: 'root', fullPath: '', isDir: true, children: {} };
  if (!props.files) return root;
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
  // Replace the object (immutable update) so a shallow watcher detects the change
  // without having to deep-watch the whole tree.
  const next = toggledDirs.value[path] === undefined ? false : !toggledDirs.value[path];
  toggledDirs.value = { ...toggledDirs.value, [path]: next };
}

function isDirOpen(path: string) {
  return toggledDirs.value[path] !== false;
}

const listData = ref<any[]>([]);

function updateListData() {
  if (props.viewMode && props.viewMode !== 'tree') {
    listData.value = (props.files || []).map(f => ({
      name: props.viewMode === 'list' ? f.path : f.path.split('/').pop()!,
      fullPath: f.path,
      isDir: false,
      status: f.status,
      level: 0,
      pathPrefix: f.path.split('/').slice(0, -1).join('/')
    }));
    return;
  }

  // Tree mode: flatten the hierarchy
  const flattened: any[] = [];
  
  const processNode = (node: TreeNode, level: number) => {
    if (node.name !== 'root') {
      flattened.push({
        name: node.name,
        fullPath: node.fullPath,
        isDir: node.isDir,
        status: node.status,
        level
      });
    }
    
    if (node.name === 'root' || (node.isDir && isDirOpen(node.fullPath))) {
      const sortedChildren = Object.values(node.children);
      sortedChildren.forEach(child => processNode(child, node.name === 'root' ? 0 : level + 1));
    }
  };
  
  processNode(tree.value, 0);
  listData.value = flattened;
}

// `files` is replaced by reference on change and `toggledDirs` is a Set whose
// reference is swapped on toggle, so a shallow watch suffices — deep-watching a
// large file list traversed every entry on every reactive tick.
watch([() => props.files, () => toggledDirs.value, () => props.viewMode], () => {
  updateListData();
}, { immediate: true });



function getStatusIcon(status: string) {
  if (!status) return 'lucide:file';
  const s = status.toLowerCase();

  if (s.includes('conflicted')) return 'lucide:alert-triangle';
  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'lucide:plus';
  if (s.includes('deleted')) return 'lucide:minus';
  if (s.includes('renamed') || s.includes('moved')) return 'lucide:repeat';
  if (s.includes('modified') || s.includes('staged')) return 'lucide:file-text';

  return 'lucide:file';
}

function getStatusColor(status: string, isSelected: boolean) {
  const s = (status || '').toLowerCase();
  if (s.includes('conflicted')) return 'text-removed';
  if (isSelected) return 'text-accent-fg';
  if (!status) return 'text-content-muted';

  if (s.includes('untracked') || s.includes('added') || s.includes('new')) return 'text-green-500';
  if (s.includes('deleted')) return 'text-red-500';
  if (s.includes('renamed') || s.includes('moved')) return 'text-purple-400';
  if (s.includes('modified') || s.includes('staged')) return 'text-[#E2B93D]';

  return 'text-content-muted';
}

const isConflicted = (status?: string) => (status || '').toLowerCase().includes('conflicted');
</script>

<template>
  <div :class="cn('v-stack select-none h-full overflow-hidden')" style="contain: content;">
    <div v-if="files.length === 0" :class="cn('px-4 py-8 text-center text-xs text-content-muted italic uppercase tracking-widest font-bold')">
      {{ t('changes.no_files_changed') }}
    </div>
    <VirtualScroll
      v-else
      :items="listData"
      :item-height="28"
      :overscan="10"
      :class="cn('flex-1 min-h-0')"
      @contextmenu.prevent="emit('contextmenu', '', $event)"
      v-slot="{ item }"
    >
      <div
        @click="item.data.isDir ? toggleDir(item.data.fullPath) : emit('select', item.data.fullPath, $event)"
        @dblclick="!item.data.isDir && emit('dblclick', item.data.fullPath)"
        @contextmenu.stop.prevent="emit('contextmenu', item.data.fullPath, $event)"
        :class="cn(
          'h-stack gap-1.5 py-1 px-3 cursor-pointer hover:bg-surface-hover transition-none group overflow-hidden border-l-2 border-transparent',
          (selectedPath === item.data.fullPath || (selectedPaths && selectedPaths.includes(item.data.fullPath))) ? 'bg-accent/20 text-content-strong border-l-accent'
            : (isConflicted(item.data.status) ? 'text-removed' : 'text-content-muted')
        )"
        :style="{ paddingLeft: (item.data.level * 12 + 12) + 'px', height: '28px' }"
        @mouseenter="startMarquee($event, '.truncate')" @mouseleave="stopMarquee($event, '.truncate')"
      >
        <template v-if="item.data.isDir">
          <span :class="cn('text-[10px] text-neutral-600 group-hover:text-neutral-600 dark:group-hover:text-neutral-400 transition-colors w-3 shrink-0 marquee-icon')">
            <Icon :icon="isDirOpen(item.data.fullPath) ? 'lucide:chevron-down' : 'lucide:chevron-right'" />
          </span>
          <Icon
            :icon="isDirOpen(item.data.fullPath) ? 'lucide:folder-open' : 'lucide:folder'"
            :class="cn(
              'text-xs shrink-0 marquee-icon text-accent/50',
              selectedPath === item.data.fullPath ? 'text-content-strong' : ''
            )"
          />
        </template>
        <template v-else>
          <Icon
            :icon="getStatusIcon(item.data.status || '')"
            :class="cn('text-xs shrink-0 marquee-icon', getStatusColor(item.data.status || '', !!(selectedPath === item.data.fullPath || (selectedPaths && selectedPaths.includes(item.data.fullPath)))))"
          />
        </template>

        <div v-if="viewMode === 'flat' && !item.data.isDir" :class="cn('text-xs truncate flex-1 min-w-0 h-stack items-baseline gap-2', selectedPath === item.data.fullPath ? 'font-bold' : '')">
          <span class="shrink-0">{{ item.data.name }}</span>
          <span class="text-[10px] opacity-40 truncate">{{ item.data.pathPrefix }}</span>
        </div>
        <div v-else :class="cn('text-xs truncate flex-1 min-w-0', selectedPath === item.data.fullPath ? 'font-bold' : '')">
          {{ item.data.name }}
        </div>
      </div>
    </VirtualScroll>
  </div>
</template>

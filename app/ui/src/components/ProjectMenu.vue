<script setup lang="ts">
/**
 * Project switcher popover, anchored under the toolbar's folder button.
 *
 * A project is a group of repositories: picking one here swaps the whole tab bar
 * for that project's repos. Creating/editing (name + colour) is delegated to
 * ProjectModal, which lives in AppLayout so it outlives this popover.
 */
import { computed, ref, nextTick, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { projects, activeProjectId } from '../services/projectService';
import { switchProject, deleteProject } from '../services/workspaceService';
import { requestConfirm, projectModal } from '../services/modalService';
import ScrollArea from './Common/ScrollArea.vue';
import SearchInput from './Common/SearchInput.vue';
import Tooltip from './Common/Tooltip.vue';

const props = defineProps<{ x: number }>();
const emit = defineEmits(['close']);

const { t } = useI18n();

const left = computed(() => Math.max(8, Math.min(props.x, window.innerWidth - 290)));

/**
 * The list scrolls at ~8 rows, but scrolling alone stops being usable once a
 * user accumulates dozens of projects — so past this many the popover grows a
 * filter and focuses it, making the menu type-to-find.
 */
const SEARCH_THRESHOLD = 8;
const query = ref('');
const searchable = computed(() => projects.value.length > SEARCH_THRESHOLD);

const visibleProjects = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return projects.value;
    return projects.value.filter(p => label(p).toLowerCase().includes(q));
});

onMounted(() => {
    if (searchable.value) nextTick(() => {
        (document.querySelector('#project-search input') as HTMLInputElement | null)?.focus();
    });
});

/** The implicit first project is stored nameless — label it at render time. */
const label = (p: { name: string }) => p.name || t('project.default_name');

function choose(id: string) {
    switchProject(id);
    emit('close');
}

function openCreate() {
    emit('close');
    projectModal.value = { mode: 'create' };
}

function openEdit(id: string) {
    emit('close');
    projectModal.value = { mode: 'edit', id };
}

function handleDelete(id: string) {
    const p = projects.value.find(x => x.id === id);
    if (!p) return;
    emit('close');
    requestConfirm(
        t('project.delete'),
        t('project.delete_message', { name: label(p) }),
        true,
        () => deleteProject(id)
    );
}
</script>

<template>
  <!-- Click-away backdrop -->
  <div class="fixed inset-0 z-40" style="-webkit-app-region: no-drag;" @click="emit('close')"></div>

  <div class="fixed w-72 bg-overlay border border-line-strong rounded-md shadow-xl z-50 overflow-hidden"
       :style="{ top: '40px', left: left + 'px' }" style="-webkit-app-region: no-drag;">

    <div class="h-stack items-center justify-between gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-content-muted border-b border-line">
      <span>{{ t('project.title') }}</span>
      <span class="tabular-nums opacity-70">{{ projects.length }}</span>
    </div>

    <!-- Type-to-find, only once the list is long enough to need it -->
    <div v-if="searchable" id="project-search" class="px-2 py-2 border-b border-line">
      <SearchInput v-model="query" :placeholder="t('project.search')" />
    </div>

    <ScrollArea class="max-h-[320px]">
      <div
        v-for="p in visibleProjects" :key="p.id"
        @click="choose(p.id)"
        class="group h-stack items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-line/50 last:border-b-0"
        :class="p.id === activeProjectId ? 'bg-surface-hover' : 'hover:bg-surface-hover'"
      >
        <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: p.color }"></div>

        <div class="flex-1 min-w-0">
          <div class="truncate text-xs font-medium" :class="p.id === activeProjectId ? 'text-content-strong' : 'text-content'">
            {{ label(p) }}
          </div>
          <div class="text-[10px] text-content-muted">{{ t('project.repo_count', { count: p.tabs.length }, p.tabs.length) }}</div>
        </div>

        <Icon v-if="p.id === activeProjectId" icon="lucide:check" class="w-3.5 h-3.5 text-accent shrink-0" />

        <div class="h-stack items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
          <Tooltip :text="t('project.edit')" position="bottom">
            <button class="p-1 rounded text-content-muted hover:text-content-strong hover:bg-surface" @click.stop="openEdit(p.id)">
              <Icon icon="lucide:settings-2" class="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <!-- The last project is never deletable: tabs would have nowhere to live. -->
          <Tooltip v-if="projects.length > 1" :text="t('project.delete')" position="bottom">
            <button class="p-1 rounded text-content-muted hover:text-removed hover:bg-surface" @click.stop="handleDelete(p.id)">
              <Icon icon="lucide:trash-2" class="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      <div v-if="visibleProjects.length === 0" class="px-3 py-6 center text-[11px] text-content-muted">
        {{ t('project.empty_search') }}
      </div>
    </ScrollArea>

    <button @click="openCreate"
            class="w-full h-stack items-center gap-2 px-3 py-2.5 border-t border-line text-xs text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors">
      <Icon icon="lucide:folder-plus" class="w-4 h-4" />
      <span>{{ t('project.new') }}</span>
    </button>
  </div>
</template>

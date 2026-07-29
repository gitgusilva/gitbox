<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { calculateFloatingPosition } from '../../utils/floating';
import Tooltip from '../Common/Tooltip.vue';

/**
 * Per-chart contributor picker. An empty selection means "everyone", which is
 * how every chart starts — so the filter only ever narrows what's on screen.
 */
export interface AuthorOption {
  name: string;
  color: string;
}

const props = defineProps<{
  modelValue: string[];
  options: AuthorOption[];
}>();

const emit = defineEmits<{ (e: 'update:modelValue', value: string[]): void }>();

const { t } = useI18n();

const isOpen = ref(false);
const query = ref('');
const anchorRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const panelStyle = ref({ top: '0px', left: '0px', width: '0px' });

const selected = computed(() => new Set(props.modelValue));

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? props.options.filter(o => o.name.toLowerCase().includes(q)) : props.options;
});

const summary = computed(() => {
  if (props.modelValue.length === 0) return t('stats.all_authors');
  if (props.modelValue.length === 1) return props.modelValue[0];
  return t('stats.n_selected', { n: props.modelValue.length });
});

function toggle(name: string) {
  const next = new Set(props.modelValue);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  emit('update:modelValue', [...next]);
}

function clear() {
  emit('update:modelValue', []);
}

function reposition() {
  if (!isOpen.value || !anchorRef.value || !panelRef.value) return;
  panelStyle.value = calculateFloatingPosition({
    targetRect: anchorRef.value.getBoundingClientRect(),
    floatingRect: panelRef.value.getBoundingClientRect(),
    placement: 'bottom',
    alignment: 'end',
    margin: 4,
  }) as any;
}

function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target as Node;
  if (anchorRef.value?.contains(target) || panelRef.value?.contains(target)) return;
  isOpen.value = false;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') isOpen.value = false;
}

watch(isOpen, open => {
  if (open) {
    query.value = '';
    nextTick(reposition);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
  }
});

onBeforeUnmount(() => { isOpen.value = false; });
</script>

<template>
  <div class="shrink-0 min-w-0">
    <Tooltip :text="t('stats.filter_authors')" position="top">
      <button
        ref="anchorRef"
        @click="isOpen = !isOpen"
        :class="[
          'h-stat-control max-w-[180px] px-2 rounded border text-[10px] flex items-center gap-1.5 transition-colors',
          modelValue.length ? 'border-accent text-accent bg-accent/10' : 'border-line text-content-muted hover:bg-surface-hover'
        ]"
      >
        <Icon icon="lucide:users" class="w-3 h-3 shrink-0" />
        <span class="truncate">{{ summary }}</span>
        <Icon icon="lucide:chevron-down" class="w-3 h-3 shrink-0 opacity-70" />
      </button>
    </Tooltip>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="panelRef"
        class="fixed z-[200] w-[230px] rounded-lg border border-line-strong bg-overlay shadow-2xl overflow-hidden flex flex-col"
        :style="{ top: panelStyle.top, left: panelStyle.left }"
      >
        <div class="p-2 border-b border-line flex items-center gap-1.5">
          <Icon icon="lucide:search" class="w-3 h-3 text-content-muted shrink-0" />
          <input
            v-model="query"
            :placeholder="t('stats.search_developer')"
            class="flex-1 min-w-0 bg-transparent text-[11px] text-content outline-none placeholder:text-content-muted"
          />
          <button
            v-if="modelValue.length"
            @click="clear"
            class="text-[9px] uppercase font-bold tracking-wider text-content-muted hover:text-content-strong shrink-0"
          >{{ t('stats.clear') }}</button>
        </div>

        <div class="max-h-[240px] overflow-y-auto py-1 gb-scroll">
          <button
            v-for="opt in filtered"
            :key="opt.name"
            @click="toggle(opt.name)"
            class="w-full px-2 py-1 flex items-center gap-2 text-[11px] text-content hover:bg-surface-hover text-left"
          >
            <span
              class="w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center"
              :class="selected.has(opt.name) ? 'bg-accent border-accent' : 'border-line-strong'"
            >
              <Icon v-if="selected.has(opt.name)" icon="lucide:check" class="w-2.5 h-2.5 text-accent-fg" />
            </span>
            <span class="w-2 h-2 rounded-sm shrink-0" :style="{ background: opt.color }" />
            <span class="truncate">{{ opt.name }}</span>
          </button>
          <div v-if="filtered.length === 0" class="px-3 py-3 text-[10px] text-content-muted text-center">
            {{ t('stats.no_match') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

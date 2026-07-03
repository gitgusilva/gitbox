<script setup lang="ts">
/**
 * Per-line blame for a file (HEAD), shown in a modal. The blame metadata is
 * zipped with the file content and virtualized so large files stay smooth.
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useVirtualList } from '@vueuse/core';
import { Icon } from '@iconify/vue';
import Modal from './Modal.vue';
import Tooltip from './Tooltip.vue';
import { gravatarUrl } from '../../utils/avatars';
import type { BlameLine } from '../../types/git';

const props = defineProps<{ repoPath: string; file: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();

const loading = ref(true);
const error = ref<string | null>(null);
const rows = ref<Array<{ line: number; code: string; blame?: BlameLine; isNewCommit: boolean }>>([]);

const basename = props.file.split('/').pop() || props.file;
const ROW_H = 20;

const { list, containerProps, wrapperProps } = useVirtualList(
  computed(() => rows.value),
  { itemHeight: ROW_H, overscan: 12 },
);

onMounted(async () => {
  try {
    const [blame, content] = await Promise.all([
      window.gitbox.getFileBlame(props.repoPath, props.file, 'HEAD'),
      window.gitbox.getFileContent(props.repoPath, props.file),
    ]);
    const byLine = new Map<number, BlameLine>();
    for (const b of blame || []) byLine.set(b.line, b);

    const lines = (content ?? '').split('\n');
    const built: typeof rows.value = [];
    for (let i = 1; i <= lines.length; i++) {
      const b = byLine.get(i);
      const prev = byLine.get(i - 1);
      built.push({ line: i, code: lines[i - 1] ?? '', blame: b, isNewCommit: !!b && (!prev || prev.commit !== b.commit) });
    }
    rows.value = built;
    if ((blame || []).length === 0) error.value = t('changes.no_blame_available');
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
});

const fmtDate = (time: number | string) => new Date(Number(time) * 1000).toLocaleDateString('en-GB');
</script>

<template>
  <Modal :model-value="true" :title="basename" icon="lucide:user-check" width="80vw" height="80vh" :scroll-body="false" @close="emit('close')">
    <div class="flex-1 min-h-0 flex flex-col bg-app">
      <div class="px-4 py-2 text-[11px] text-content-muted border-b border-line truncate">
        {{ t('changes_menu.blame') }} · <span class="font-mono">{{ file }}</span>
      </div>

      <div v-if="loading" class="flex-1 center text-neutral-500">
        <Icon icon="lucide:loader-2" class="w-6 h-6 animate-spin text-blue-400" />
      </div>
      <div v-else-if="error && rows.length === 0" class="flex-1 center text-red-400 text-xs px-6 text-center">{{ error }}</div>

      <div v-else v-bind="containerProps" class="flex-1 min-h-0 font-mono text-[12px]">
        <div v-bind="wrapperProps">
          <div
            v-for="{ data: r, index } in list"
            :key="index"
            class="flex items-stretch hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40"
            :style="{ height: ROW_H + 'px' }"
          >
            <!-- Blame gutter -->
            <div class="shrink-0 w-[260px] flex items-center gap-2 px-2 border-r border-line overflow-hidden bg-app">
              <template v-if="r.blame && r.isNewCommit">
                <Tooltip :text="`${r.blame.author}\n${r.blame.summary}`" position="right">
                  <img :src="gravatarUrl(r.blame.email)" class="w-3.5 h-3.5 rounded-sm border border-line-strong shrink-0" />
                </Tooltip>
                <span class="text-[10px] text-neutral-500 truncate flex-1">{{ r.blame.author }}</span>
                <span class="text-[9.5px] text-neutral-400 opacity-70 shrink-0">{{ fmtDate(r.blame.time) }}</span>
                <span class="text-[9.5px] text-neutral-400 shrink-0">{{ (r.blame.commit || '').slice(0, 7) }}</span>
              </template>
            </div>
            <!-- Line number -->
            <div class="shrink-0 w-[52px] text-right pr-2 text-neutral-400 select-none border-r border-neutral-100 dark:border-neutral-800/50 flex items-center justify-end">{{ r.line }}</div>
            <!-- Code -->
            <pre class="flex-1 min-w-0 px-3 whitespace-pre overflow-hidden text-content flex items-center">{{ r.code }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

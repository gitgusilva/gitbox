<script setup lang="ts">
/** Commit history of a single file (git log --follow), shown in a modal. */
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import Modal from './Modal.vue';
import ScrollArea from './ScrollArea.vue';
import Tooltip from './Tooltip.vue';
import { gravatarUrl } from '../../utils/avatars';
import type { FileHistoryEntry } from '../../types/git';

const props = defineProps<{ repoPath: string; file: string }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();

const entries = ref<FileHistoryEntry[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const basename = props.file.split('/').pop() || props.file;
const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString();

onMounted(async () => {
  try {
    entries.value = await window.gitbox.fileHistory(props.repoPath, props.file);
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <Modal :model-value="true" :title="basename" icon="lucide:history" width="660px" height="72vh" :scroll-body="false" @close="emit('close')">
    <div class="flex-1 min-h-0 flex flex-col bg-app">
      <div class="px-4 py-2 text-[11px] text-content-muted border-b border-line truncate">
        {{ t('changes_menu.history') }} · <span class="font-mono">{{ file }}</span>
      </div>

      <div v-if="loading" class="flex-1 center text-neutral-500">
        <Icon icon="lucide:loader-2" class="w-6 h-6 animate-spin text-blue-400" />
      </div>
      <div v-else-if="error" class="flex-1 center text-red-400 text-xs px-6 text-center">{{ error }}</div>
      <div v-else-if="entries.length === 0" class="flex-1 center text-neutral-500 text-xs">{{ t('changes.no_history') }}</div>

      <ScrollArea v-else class="flex-1 min-h-0">
        <div
          v-for="c in entries"
          :key="c.id"
          class="flex items-start gap-3 px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
        >
          <Tooltip :text="`${c.author} <${c.email}>`" position="right">
            <img :src="gravatarUrl(c.email)" class="w-6 h-6 rounded-full border border-line shrink-0 mt-0.5" />
          </Tooltip>
          <div class="min-w-0 flex-1">
            <div class="text-[12px] text-content truncate">{{ c.summary }}</div>
            <div class="text-[10.5px] text-neutral-500 flex items-center gap-2 mt-0.5">
              <span class="truncate">{{ c.author }}</span>
              <span class="opacity-60">·</span>
              <span class="whitespace-nowrap">{{ fmtDate(c.timestamp) }}</span>
            </div>
          </div>
          <code class="text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{{ c.id.slice(0, 7) }}</code>
        </div>
      </ScrollArea>
    </div>
  </Modal>
</template>

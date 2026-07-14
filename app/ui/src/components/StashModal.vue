<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { stashModal } from '../services/modalService';
import { stashIncludeUntracked } from '../services/gitService';
import Modal from './Common/Modal.vue';
import Checkbox from './Common/Checkbox.vue';

const { t } = useI18n();

const message = ref('');
// Keep-index is a per-invocation choice (defaults off); "include untracked" is
// bound directly to the persistent setting so its state survives restarts.
const keepIndex = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => stashModal.value, (v) => {
  if (v) {
    message.value = '';
    keepIndex.value = false;
    nextTick(() => inputRef.value?.focus());
  }
}, { immediate: true });

function confirm() {
  const m = stashModal.value;
  if (!m) return;
  m.onConfirm(message.value.trim(), {
    keepIndex: keepIndex.value,
    includeUntracked: stashIncludeUntracked.value,
  });
  stashModal.value = null;
}

function cancel() {
  stashModal.value = null;
}
</script>

<template>
  <Modal v-if="stashModal" :modelValue="true" @update:modelValue="!$event && cancel()" :title="t('changes.stash_title')" width="480px">
    <div class="p-6 space-y-5">
      <!-- Message -->
      <div class="flex items-center gap-3">
        <span class="w-24 shrink-0 text-right text-xs text-content-muted">{{ t('changes.stash_message_label') }}</span>
        <input ref="inputRef" v-model="message" type="text" spellcheck="false"
               :placeholder="t('changes.stash_placeholder')"
               class="flex-1 min-w-0 bg-surface border border-line-strong/50 rounded px-3 py-2 text-xs text-content-strong focus:border-accent outline-none placeholder-content-muted"
               @keydown.enter="confirm" />
      </div>

      <!-- Options -->
      <div class="v-stack gap-3 pl-[6.75rem]">
        <Checkbox v-model="keepIndex" :label="t('changes.stash_mode_keep_index')" />
        <!-- Persisted across restarts (matches git's default: off). -->
        <Checkbox v-model="stashIncludeUntracked" :label="t('changes.stash_mode_include_untracked')" />
      </div>

      <!-- Footer note -->
      <p class="text-[11px] text-content-muted leading-relaxed pl-[6.75rem]">
        <template v-if="stashIncludeUntracked">{{ t('changes.stash_mode_include_untracked_hint') }}<br /></template>
        {{ t('changes.stash_files_note', { count: stashModal.fileCount }) }}
      </p>

      <div class="flex justify-end gap-3 pt-1">
        <button @click="cancel" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest border border-line-strong bg-surface text-content-muted hover:bg-surface-hover hover:text-content transition-all outline-none">{{ t('common.cancel') }}</button>
        <button @click="confirm" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest text-accent-fg bg-accent hover:bg-accent-hover shadow-lg transition-all outline-none">{{ t('common.ok') }}</button>
      </div>
    </div>
  </Modal>
</template>

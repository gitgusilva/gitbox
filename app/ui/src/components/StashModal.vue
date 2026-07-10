<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { stashModal } from '../services/modalService';
import Modal from './Common/Modal.vue';
import Select from './Common/Select.vue';

const { t } = useI18n();

const message = ref('');
const mode = ref<'default' | 'keep_index' | 'include_untracked'>('default');
const inputRef = ref<HTMLInputElement | null>(null);

// git-accurate presets for `git stash push`. Mutually exclusive in the dropdown
// to keep it simple (the common cases); each maps to real stash flags.
const modeOptions = computed(() => [
  { value: 'default', label: t('changes.stash_mode_default') },
  { value: 'keep_index', label: t('changes.stash_mode_keep_index') },
  { value: 'include_untracked', label: t('changes.stash_mode_include_untracked') },
]);

const modeHint = computed(() => t(`changes.stash_mode_${mode.value}_hint`));

watch(() => stashModal.value, (v) => {
  if (v) {
    message.value = '';
    mode.value = 'default';
    nextTick(() => inputRef.value?.focus());
  }
}, { immediate: true });

function confirm() {
  const m = stashModal.value;
  if (!m) return;
  m.onConfirm(message.value.trim(), {
    keepIndex: mode.value === 'keep_index',
    includeUntracked: mode.value === 'include_untracked',
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
      <!-- Mode -->
      <div class="flex items-center gap-3">
        <span class="w-24 shrink-0 text-right text-xs text-content-muted">{{ t('changes.stash_mode') }}</span>
        <div class="flex-1 min-w-0">
          <Select v-model="mode" :options="modeOptions" searchable class="w-full" />
        </div>
      </div>

      <!-- Message -->
      <div class="flex items-center gap-3">
        <span class="w-24 shrink-0 text-right text-xs text-content-muted">{{ t('changes.stash_message_label') }}</span>
        <input ref="inputRef" v-model="message" type="text" spellcheck="false"
               :placeholder="t('changes.stash_placeholder')"
               class="flex-1 min-w-0 bg-surface border border-line-strong/50 rounded px-3 py-2 text-xs text-content-strong focus:border-accent outline-none placeholder-content-muted"
               @keydown.enter="confirm" />
      </div>

      <!-- Footer note -->
      <p class="text-[11px] text-content-muted leading-relaxed pl-[6.75rem]">
        {{ modeHint }}<br />
        {{ t('changes.stash_files_note', { count: stashModal.fileCount }) }}
      </p>

      <div class="flex justify-end gap-3 pt-1">
        <button @click="cancel" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest border border-line-strong bg-surface text-content-muted hover:bg-surface-hover hover:text-content transition-all outline-none">{{ t('common.cancel') }}</button>
        <button @click="confirm" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest text-accent-fg bg-accent hover:bg-accent-hover shadow-lg transition-all outline-none">{{ t('common.ok') }}</button>
      </div>
    </div>
  </Modal>
</template>

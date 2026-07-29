<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';

const { t } = useI18n();

const props = defineProps<{
  title: string;
  message?: string;
  danger?: boolean;
  confirmText?: string;
  confirmDisabled?: boolean;
  hideCancel?: boolean;
  hideButtons?: boolean;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

// Enter only. Escape is handled by Modal, for every dialog at once — keeping a
// second listener here fired `cancel` twice on one key press.
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !props.confirmDisabled) {
    emit('confirm');
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <Modal :modelValue="true" @update:modelValue="!$event && emit('cancel')" :title="title" width="512px">
    <template #header>
        <div class="flex items-center justify-between p-6 pb-2" v-bind="$attrs">
          <div class="font-bold text-base tracking-tight" :class="danger ? 'text-removed' : 'text-content-strong'">{{ title }}</div>
          <button @click="emit('cancel')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover shrink-0 -mr-2 text-content-muted hover:text-content-strong transition-colors outline-none cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
    </template>

    <div class="px-6 pb-6 pt-2">
      <div class="flex flex-col gap-4 mb-8">
        <slot>
          <div v-if="message" class="text-sm text-content leading-relaxed whitespace-pre-wrap">{{ message }}</div>
        </slot>
      </div>
      
      <div v-if="!hideButtons" class="flex justify-end gap-3">
        <button v-if="!hideCancel" @click="emit('cancel')" class="px-5 py-2 rounded border border-line-strong text-xs font-bold bg-surface hover:bg-surface-hover text-content-muted hover:text-content-strong transition-all outline-none uppercase tracking-widest">{{ t('common.cancel') }}</button>
        <button @click="emit('confirm')" :disabled="confirmDisabled"
                class="px-5 py-2 rounded text-xs font-bold transition-all outline-none disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest shadow-lg shadow-black/20"
                :class="danger ? 'bg-removed hover:bg-removed/80 text-white' : 'bg-accent hover:bg-accent-hover text-accent-fg'">
          {{ confirmText || t('common.confirm') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

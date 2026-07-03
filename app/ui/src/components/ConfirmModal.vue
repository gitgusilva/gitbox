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

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('cancel');
  } else if (e.key === 'Enter') {
    if (!props.confirmDisabled) {
      emit('confirm');
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeyDown));
onUnmounted(() => document.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <Modal :modelValue="true" @update:modelValue="!$event && emit('cancel')" :title="title" width="512px">
    <template #header>
        <div class="flex items-center justify-between p-6 pb-2" v-bind="$attrs">
          <div class="font-bold text-base tracking-tight" :class="danger ? 'text-red-400' : 'text-neutral-100'">{{ title }}</div>
          <button @click="emit('cancel')" class="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors outline-none cursor-pointer">
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
        <button v-if="!hideCancel" @click="emit('cancel')" class="px-5 py-2 rounded border border-line-strong text-xs font-bold bg-surface hover:bg-neutral-200 dark:hover:bg-neutral-800 text-content-muted hover:text-neutral-900 dark:hover:text-white transition-all outline-none uppercase tracking-widest">{{ t('common.cancel') }}</button>
        <button @click="emit('confirm')" :disabled="confirmDisabled" 
                class="px-5 py-2 rounded text-xs font-bold text-white transition-all outline-none disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest" 
                :class="danger ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20'">
          {{ confirmText || t('common.confirm') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

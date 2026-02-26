<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import ConfirmModal from './ConfirmModal.vue';

const props = defineProps<{
  title: string;
  message: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
}>();

const emit = defineEmits<{
  (e: 'confirm', value: string): void;
  (e: 'cancel'): void;
}>();

const inputValue = ref(props.initialValue || '');
const inputRef = ref<HTMLInputElement | null>(null);

function handleConfirm() {
  if (inputValue.value.trim()) {
    emit('confirm', inputValue.value.trim());
  }
}

function handleCancel() {
  emit('cancel');
}

onMounted(() => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      if (props.initialValue) {
        inputRef.value.select();
      }
    }
  });
});
</script>

<template>
  <ConfirmModal
    :title="title"
    :confirmText="confirmText"
    :confirmDisabled="!inputValue.trim()"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <div class="text-xs text-neutral-300">{{ message }}</div>
    <input ref="inputRef" @keydown.enter="handleConfirm" v-model="inputValue" type="text" spellcheck="false" class="w-full bg-[#1E1E1E] border border-neutral-600 rounded px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none" :placeholder="placeholder" />
  </ConfirmModal>
</template>

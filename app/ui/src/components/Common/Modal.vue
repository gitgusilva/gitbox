<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';

interface Props {
  modelValue: boolean;
  title?: string;
  icon?: string;
  iconColor?: string;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  hideCloseBtn?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
}>();

function close() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" 
         class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
         @click.self="close">
      <div class="bg-[#1e1e20] border border-neutral-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden scale-in-center flex flex-col"
           :style="{ 
             width: width || '600px', 
             height: height,
             minWidth: minWidth,
             minHeight: minHeight,
             maxHeight: maxHeight || '90vh' 
           }">
        
        <!-- Header slot or Default Header -->
        <slot name="header">
          <header v-if="title" class="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-[#252526] flex-shrink-0">
            <div class="flex items-center gap-2.5">
              <Icon v-if="icon" :icon="icon" :class="iconColor || 'text-blue-500'" class="text-lg" />
              <h1 class="font-bold text-sm text-neutral-200 tracking-tight">
                {{ title }}
              </h1>
            </div>
            <button v-if="!hideCloseBtn" @click="close" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-all">
              <Icon icon="lucide:x" class="text-lg" />
            </button>
          </header>
        </slot>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto flex flex-col min-h-0 min-w-0">
            <slot />
        </div>

        <!-- Footer -->
        <slot name="footer"></slot>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scale-in-center {
  animation: scale-in-center 0.2s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
}
@keyframes scale-in-center {
  0% { transform: scale(0.95); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>

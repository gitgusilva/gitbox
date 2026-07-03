<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';
import ScrollArea from './ScrollArea.vue';

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
  /** When false, the body is a plain flex container (no scroll wrapper) so the
   *  slotted content can manage its own height/scrolling and fill the modal. */
  scrollBody?: boolean;
  class?: string;
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
         class="fixed inset-0 z-[100] center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" 
         @click.self="close">
      <div :class="cn(
            'bg-app border border-line rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden scale-in-center v-stack',
            height ? '' : 'h-min',
            props.class
           )"
           :style="{ 
             width: width || '600px', 
             height: height,
             minWidth: minWidth,
             minHeight: minHeight,
             maxHeight: maxHeight || '90vh' 
           }">
        
        <!-- Header slot or Default Header -->
        <slot name="header">
          <header v-if="title" class="h-14 border-b border-line h-stack justify-between px-6 bg-surface shrink-0">
            <div class="h-stack gap-2.5">
              <Icon v-if="icon" :icon="icon" :class="cn(iconColor || 'text-blue-500', 'text-lg')" />
              <h1 class="font-bold text-sm text-content tracking-tight">
                {{ title }}
              </h1>
            </div>
            <button v-if="!hideCloseBtn" @click="close" class="w-8 h-8 center rounded-lg hover:bg-white/5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-all">
              <Icon icon="lucide:x" class="text-lg" />
            </button>
          </header>
        </slot>

        <!-- Body -->
        <ScrollArea v-if="scrollBody !== false" class="flex-1 v-stack min-h-0 min-w-0">
            <slot />
        </ScrollArea>
        <div v-else class="flex-1 v-stack min-h-0 min-w-0 overflow-hidden">
            <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" class="shrink-0 border-t border-line px-6 py-4 bg-app">
          <slot name="footer"></slot>
        </div>
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

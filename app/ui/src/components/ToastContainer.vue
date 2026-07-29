<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { toasts, removeToast } from '../services/toastService';
import { generalSettings } from '../services/settingsService';
import { openExternalUrl } from '../utils/formatters';

const positionClass = computed(() => {
  switch (generalSettings.value.notificationPosition) {
    // bottom-9 clears the 22px status-bar footer so toasts don't sit glued to it.
    case 'bottom-left': return 'bottom-9 left-6 items-start';
    case 'top-right': return 'top-6 right-6 items-end flex-col-reverse';
    case 'top-left': return 'top-6 left-6 items-start flex-col-reverse';
    case 'bottom-right':
    default: return 'bottom-9 right-6 items-end';
  }
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-[9999] flex flex-col gap-3 pointer-events-none" :class="positionClass">
      <TransitionGroup 
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-4 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-95">
          
        <div v-for="toast in toasts" :key="toast.id" 
             class="w-[380px] rounded-lg shadow-2xl flex overflow-hidden pointer-events-auto bg-surface border border-line/50"
             :class="{
                 'border-l-4 border-l-removed': toast.type === 'error',
                 'border-l-4 border-l-added': toast.type === 'success',
                 'border-l-4 border-l-modified': toast.type === 'warning',
                 'border-l-4 border-l-accent': toast.type === 'info'
             }">
          
          <!-- Icon Section -->
          <div class="w-12 flex items-start justify-center pt-4"
               :class="{
                   'bg-removed/10 text-removed': toast.type === 'error',
                   'bg-added/10 text-added': toast.type === 'success',
                   'bg-modified/10 text-modified': toast.type === 'warning',
                   'bg-accent/10 text-accent': toast.type === 'info'
               }">
               <Icon v-if="toast.type === 'error'" icon="lucide:x-circle" class="text-xl" />
               <Icon v-else-if="toast.type === 'success'" icon="lucide:check-circle-2" class="text-xl" />
               <Icon v-else-if="toast.type === 'warning'" icon="lucide:alert-triangle" class="text-xl" />
               <Icon v-else icon="lucide:info" class="text-xl" />
          </div>

          <!-- Content Section -->
          <div class="flex-1 p-3 pr-8 relative">
              <button @click="removeToast(toast.id)" class="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-lg text-content-muted hover:text-content-strong hover:bg-surface-hover transition-colors">
                  <Icon icon="lucide:x" class="text-sm" />
              </button>
              <h3 class="font-bold text-sm text-content mb-1 leading-tight">{{ toast.title }}</h3>
              <p class="text-xs text-content-muted leading-relaxed">{{ toast.message }}</p>
              <button v-if="toast.link" @click="openExternalUrl(toast.link)" class="block mt-2 text-xs text-accent hover:underline text-left break-all">
                  {{ toast.link }}
              </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { toasts, removeToast } from '../services/toastService';
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <TransitionGroup 
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-4 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-95">
          
        <div v-for="toast in toasts" :key="toast.id" 
             class="w-[380px] rounded-lg shadow-2xl flex overflow-hidden pointer-events-auto bg-[#2b2d31] border border-neutral-700/50"
             :class="{
                 'border-l-4 border-l-red-500': toast.type === 'error',
                 'border-l-4 border-l-green-500': toast.type === 'success',
                 'border-l-4 border-l-yellow-500': toast.type === 'warning',
                 'border-l-4 border-l-blue-500': toast.type === 'info'
             }">
          
          <!-- Icon Section -->
          <div class="w-12 flex items-start justify-center pt-4"
               :class="{
                   'bg-red-500/10 text-red-500': toast.type === 'error',
                   'bg-green-500/10 text-green-500': toast.type === 'success',
                   'bg-yellow-500/10 text-yellow-500': toast.type === 'warning',
                   'bg-blue-500/10 text-blue-500': toast.type === 'info'
               }">
               <Icon v-if="toast.type === 'error'" icon="lucide:x-circle" class="text-xl" />
               <Icon v-else-if="toast.type === 'success'" icon="lucide:check-circle-2" class="text-xl" />
               <Icon v-else-if="toast.type === 'warning'" icon="lucide:alert-triangle" class="text-xl" />
               <Icon v-else icon="lucide:info" class="text-xl" />
          </div>

          <!-- Content Section -->
          <div class="flex-1 p-3 pr-8 relative">
              <button @click="removeToast(toast.id)" class="absolute top-2 right-2 text-neutral-500 hover:text-white transition-colors">
                  <Icon icon="lucide:x" class="text-sm" />
              </button>
              <h3 class="font-bold text-sm text-neutral-200 mb-1 leading-tight">{{ toast.title }}</h3>
              <p class="text-xs text-neutral-400 leading-relaxed">{{ toast.message }}</p>
              <a v-if="toast.link" :href="toast.link" target="_blank" class="block mt-2 text-xs text-blue-400 hover:underline">
                  {{ toast.link }}
              </a>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

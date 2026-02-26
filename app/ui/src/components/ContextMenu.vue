<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  x: number;
  y: number;
  items: Array<{
    label: string;
    action?: () => void;
    icon?: string;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    separator?: boolean;
  }>;
}>();

const emit = defineEmits(['close']);

const menuElement = ref<HTMLElement | null>(null);

function onClickOutside(event: MouseEvent) {
  if (menuElement.value && !menuElement.value.contains(event.target as Node)) {
    emit('close');
  }
}

function handleItemClick(item: any) {
  if (item.disabled || item.separator) return;
  if (item.action) item.action();
  emit('close');
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-50 pointer-events-auto" :style="{ top: y + 'px', left: x + 'px' }">
    <div ref="menuElement" class="bg-[#2D2D2D] border border-neutral-700 min-w-[220px] rounded shadow-xl py-1 flex flex-col pointer-events-auto text-[#E0E0E0] text-xs">
      <template v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div v-if="item.separator" class="h-px bg-neutral-700 my-1 mx-2"></div>
        
        <!-- Menu Item -->
        <button v-else @click="handleItemClick(item)" 
                class="flex items-center justify-between px-4 py-1.5 w-full text-left"
                :class="[
                  item.disabled ? 'opacity-50 cursor-not-allowed text-neutral-500' : 'hover:bg-[#4A4A4A] cursor-pointer text-[#E0E0E0]',
                  item.danger && !item.disabled ? 'text-red-400 hover:text-red-300' : ''
                ]">
          <div class="flex items-center gap-2 flex-1">
            <span v-if="item.icon" class="w-4 text-center text-sm flex items-center justify-center"><Icon :icon="item.icon" /></span>
            <span v-else class="w-4"></span>
            <span :class="{'font-medium': !item.disabled}">{{ item.label }}</span>
          </div>
          <span v-if="item.shortcut" class="text-neutral-500 ml-4 whitespace-nowrap">{{ item.shortcut }}</span>
        </button>
      </template>
      </div>
    </div>
  </Teleport>
</template>

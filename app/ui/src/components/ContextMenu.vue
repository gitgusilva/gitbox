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
    active?: boolean;
    checked?: boolean;
    subItems?: Array<any>;
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

const hoverIndex = ref<number | null>(null);

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
    <div ref="menuElement" class="bg-neutral-100 dark:bg-[#2D2D2D] border border-neutral-300 dark:border-neutral-700 min-w-[220px] rounded shadow-xl py-1 flex flex-col pointer-events-auto text-neutral-700 dark:text-[#E0E0E0] text-xs">
      <template v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div v-if="item.separator" class="h-px bg-neutral-300 dark:bg-neutral-700 my-1 mx-2"></div>
        
        <!-- Menu Item -->
        <div v-else 
             class="relative group"
             @mouseenter="hoverIndex = index"
             @mouseleave="hoverIndex = null">
          <button @click="!item.subItems?.length && handleItemClick(item)" 
                  class="flex items-center justify-between px-4 py-1.5 w-full text-left"
                  :class="[
                    item.disabled ? 'opacity-50 cursor-not-allowed text-neutral-500' : 'hover:bg-neutral-200 dark:hover:bg-[#4A4A4A] cursor-pointer text-neutral-700 dark:text-[#E0E0E0]',
                    item.danger && !item.disabled ? 'text-red-400 hover:text-red-300' : ''
                  ]">
          <div class="flex items-center gap-2 flex-1">
            <span v-if="item.active || item.checked" class="w-4 text-center text-xs flex items-center justify-center text-blue-400">
              <Icon icon="lucide:check" />
            </span>
            <span v-else-if="item.icon" class="w-4 text-center text-sm flex items-center justify-center"><Icon :icon="item.icon" /></span>
            <span v-else class="w-4"></span>
            <span :class="{'font-medium': !item.disabled, 'text-blue-400': item.active || item.checked}">{{ item.label }}</span>
          </div>
          <div v-if="item.shortcut || item.subItems?.length" class="text-neutral-500 flex items-center gap-2">
            <span v-if="item.shortcut" class="whitespace-nowrap">{{ item.shortcut }}</span>
            <Icon v-if="item.subItems?.length" icon="lucide:chevron-right" class="text-neutral-600 dark:text-neutral-400" />
          </div>
          </button>
          
          <!-- Submenu -->
          <div v-if="item.subItems?.length && hoverIndex === index" 
               class="absolute left-full top-0 bg-neutral-100 dark:bg-[#2D2D2D] border border-neutral-300 dark:border-neutral-700 min-w-[220px] rounded shadow-xl py-1 flex flex-col text-neutral-700 dark:text-[#E0E0E0] text-xs pointer-events-auto ml-1 z-50">
            <template v-for="(subItem, subIndex) in item.subItems" :key="'sub_'+subIndex">
              <div v-if="subItem.separator" class="h-px bg-neutral-300 dark:bg-neutral-700 my-1 mx-2"></div>
              <button v-else @click.stop="handleItemClick(subItem)" 
                      class="flex items-center justify-between px-4 py-1.5 w-full text-left"
                      :class="[
                        subItem.disabled ? 'opacity-50 cursor-not-allowed text-neutral-500' : 'hover:bg-neutral-200 dark:hover:bg-[#4A4A4A] cursor-pointer text-neutral-700 dark:text-[#E0E0E0]'
                      ]">
                <div class="flex items-center gap-2 flex-1">
                  <span v-if="subItem.icon" class="w-4 text-center text-sm flex items-center justify-center"><Icon :icon="subItem.icon" /></span>
                  <span v-else class="w-4"></span>
                  <span :class="{'font-medium': !subItem.disabled}">{{ subItem.label }}</span>
                </div>
              </button>
            </template>
          </div>
        </div>
      </template>
      </div>
    </div>
  </Teleport>
</template>

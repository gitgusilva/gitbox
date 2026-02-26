<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Icon } from '@iconify/vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

const props = defineProps<{
  x: number;
  y: number;
  items: Array<{
    label: string;
    sublabel?: string;
    action?: () => void;
    icon?: string;
    badge?: string;
  }>;
  placeholder?: string;
}>();

const emit = defineEmits(['close']);

const menuElement = ref<HTMLElement | null>(null);
const searchInput = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const filteredItems = computed(() => {
  if (!searchInput.value) return props.items;
  const term = searchInput.value.toLowerCase();
  return props.items.filter(i => 
    i.label.toLowerCase().includes(term) || 
    (i.sublabel && i.sublabel.toLowerCase().includes(term))
  );
});

function onClickOutside(event: MouseEvent) {
  if (menuElement.value && !menuElement.value.contains(event.target as Node)) {
    emit('close');
  }
}

function handleItemClick(item: any) {
  if (item.action) item.action();
  emit('close');
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  setTimeout(() => {
    if (inputRef.value) {
      inputRef.value.focus();
    }
  }, 50);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
});
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-50 pointer-events-auto" :style="{ top: y + 'px', left: x + 'px' }">
      <div ref="menuElement" class="bg-[#2D2D2D] border border-neutral-700 w-[260px] rounded-lg shadow-2xl py-0 flex flex-col pointer-events-auto text-[#E0E0E0] text-xs overflow-hidden">
        
        <!-- Search Input -->
        <div class="p-2 border-b border-neutral-700 bg-[#252526]">
          <div class="relative flex items-center">
            <Icon icon="lucide:search" class="absolute left-2.5 w-3.5 h-3.5 text-neutral-500" />
            <input 
              ref="inputRef"
              v-model="searchInput" 
              type="text" 
              :placeholder="placeholder || 'Pesquisar...'" 
              class="w-full bg-[#1A1A1A] border border-neutral-700 focus:border-blue-500 rounded px-8 py-1.5 text-xs text-neutral-200 outline-none transition-colors"
              @keydown.esc="emit('close')"
            />
          </div>
        </div>

        <!-- Item List -->
        <SimpleBar style="max-height: 250px;" class="flex-1 py-1">
          <div v-if="filteredItems.length === 0" class="py-4 text-center text-neutral-500">
             Nenhum resultado encontrado.
          </div>
          <template v-for="(item, index) in filteredItems" :key="index">
            <button @click="handleItemClick(item)" 
                    class="flex items-center justify-between px-3 py-2 w-full text-left hover:bg-[#4A4A4A] cursor-pointer text-[#E0E0E0] transition-colors group">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <span v-if="item.icon" class="w-4 flex-shrink-0 text-center text-sm flex items-center justify-center text-neutral-400 group-hover:text-blue-400">
                  <Icon :icon="item.icon" />
                </span>
                <div class="flex flex-col min-w-0">
                  <span class="font-medium truncate block leading-tight">{{ item.label }}</span>
                  <span v-if="item.sublabel" class="text-[9px] text-neutral-500 truncate block mt-0.5 leading-none">{{ item.sublabel }}</span>
                </div>
              </div>
              <span v-if="item.badge" class="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#141414] border border-neutral-700 text-neutral-400 group-hover:text-blue-400 group-hover:border-blue-900 flex-shrink-0">
                {{ item.badge }}
              </span>
            </button>
          </template>
        </SimpleBar>

      </div>
    </div>
  </Teleport>
</template>

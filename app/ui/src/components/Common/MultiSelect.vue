<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Icon } from '@iconify/vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';
import { useI18n } from 'vue-i18n';

interface Option {
  value: string;
  label: string;
  color?: string;
  iconUrl?: string;
}

const { t } = useI18n();

const props = defineProps<{
  options: Option[];
  modelValue: string[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string[]): void;
}>();

import { calculateFloatingPosition } from '../../utils/floating';

import { nextTick } from 'vue';

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' });

function updatePosition() {
  if (isOpen.value && containerRef.value && dropdownRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    const dropdownRect = dropdownRef.value.getBoundingClientRect();
    
    const pos = calculateFloatingPosition({
        targetRect: rect,
        floatingRect: dropdownRect,
        placement: 'bottom',
        alignment: 'start',
        margin: 4,
        matchWidth: true
    });
    
    dropdownStyle.value = pos as any;
  }
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => {
        updatePosition();
    });
  }
}

function closeDropdown(e: MouseEvent) {
  const isInsideContainer = containerRef.value?.contains(e.target as Node);
  const isInsideDropdown = dropdownRef.value?.contains(e.target as Node);
  if (!isInsideContainer && !isInsideDropdown) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', closeDropdown);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true); // true for capturing event inside scrolled elements
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', closeDropdown);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
});

function toggleOption(val: string) {
  const current = [...props.modelValue];
  const idx = current.indexOf(val);
  if (idx > -1) {
    current.splice(idx, 1);
  } else {
    current.push(val);
  }
  emit('update:modelValue', current);
}

const displayLabel = computed(() => {
  if (props.modelValue.length === 0) return props.placeholder || t('common.select');
  if (props.modelValue.length === 1) {
    const opt = props.options.find(o => o.value === props.modelValue[0]);
    return opt ? opt.label : props.modelValue[0];
  }
  return `${props.modelValue.length} ${t('common.items_selected')}`;
});
</script>

<template>
  <div class="relative group/select" ref="containerRef">
    <div @click="toggleDropdown" 
         class="w-full bg-surface border border-line rounded px-3 py-2 text-xs text-content outline-none hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-accent cursor-pointer flex items-center justify-between transition-all select-none">
       <span class="truncate pr-4">{{ displayLabel }}</span>
       <Icon icon="lucide:chevron-down" class="text-neutral-600 flex-shrink-0 transition-transform" :class="isOpen ? 'rotate-180' : ''" />
    </div>
    
    <Teleport to="body">
      <div v-if="isOpen" ref="dropdownRef"
           class="fixed bg-surface border border-line-strong rounded shadow-2xl z-[99999] flex flex-col overflow-hidden max-h-48"
           :style="dropdownStyle">
         <SimpleBar class="flex-1 w-full p-1 h-full">
           <div class="flex flex-col gap-1">
             <div v-if="options.length === 0" class="px-3 py-2 text-[10px] text-neutral-500 text-center italic">
                {{ t('settings.create_pr.no_options') }}
             </div>
             <div v-for="opt in options" :key="opt.value" 
                  @click="toggleOption(opt.value)"
                  class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
                  :class="modelValue.includes(opt.value) ? 'bg-surface-hover' : 'hover:bg-neutral-200 dark:hover:bg-[#3D3D3D]'">
                
                <!-- Checkbox visual -->
                <div class="w-3 h-3 rounded flex items-center justify-center border transition-colors flex-shrink-0"
                     :class="modelValue.includes(opt.value) ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-neutral-600'">
                    <Icon v-if="modelValue.includes(opt.value)" icon="lucide:check" class="text-[8px] text-white" />
                </div>

                <!-- Avatar or Color Box -->
                <img v-if="opt.iconUrl" :src="opt.iconUrl" class="w-4 h-4 rounded-full opacity-90 object-cover" />
                <div v-else-if="opt.color" class="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-inner" :style="{ backgroundColor: '#' + opt.color }"></div>
                
                <span class="text-xs truncate" :class="modelValue.includes(opt.value) ? 'text-white' : 'text-content'">
                   {{ opt.label }}
                </span>
             </div>
           </div>
         </SimpleBar>
      </div>
    </Teleport>
  </div>
</template>

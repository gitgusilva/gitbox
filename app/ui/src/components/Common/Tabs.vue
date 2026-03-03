<script setup lang="ts">
import { ref, provide, reactive, watchEffect, computed } from 'vue';
import { Icon } from '@iconify/vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

const props = defineProps({
  modelValue: {
    type: String,
    required: false
  },
  vertical: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

// Shared state for the whole tabs tree.
const context = reactive({
  activeTab: props.modelValue,
  tabs: [] as Array<{ id: string, label: string, icon?: string }>,
  
  register: (id: string, label: string, icon?: string) => {
    if (!context.tabs.some(t => t.id === id)) {
      context.tabs.push({ id, label, icon });
      if (!context.activeTab) {
        context.setActive(id);
      }
    }
  },
  
  unregister: (id: string) => {
    context.tabs = context.tabs.filter(t => t.id !== id);
  },
  
  update: (id: string, label: string, icon?: string) => {
    const tabIndex = context.tabs.findIndex(t => t.id === id);
    if (tabIndex !== -1) {
      context.tabs[tabIndex] = { id, label, icon };
    }
  },
  
  setActive: (id: string) => {
    context.activeTab = id;
    emit('update:modelValue', id);
    emit('change', id);
  }
});

const activeTabLabel = computed(() => {
  return context.tabs.find(t => t.id === context.activeTab)?.label || '';
});

// Update our internal reactive state if the external modelValue changes.
watchEffect(() => {
  if (props.modelValue) {
    context.activeTab = props.modelValue;
  }
});

provide('tabs-context', context);

// Expose these for parent components using ref
defineExpose({
  activeTab: computed(() => context.activeTab),
  activeTabLabel
});
</script>

<template>
  <div class="flex" :class="vertical ? 'flex-row h-full overflow-hidden' : 'flex-col'">
    <!-- Navigation (Buttons) -->
    <div :class="[
      vertical ? 'w-48 bg-[#252526] border-r border-neutral-800 flex flex-col' : 'flex border-b border-neutral-800 bg-[#252526] p-1 px-4 gap-2 h-10 items-center overflow-x-auto overflow-y-hidden no-scrollbar'
    ]">
      <slot name="sidebar-header"></slot>
      
      <SimpleBar v-if="vertical" class="flex-1 min-h-0" style="width: 100%;">
        <div class="p-2 flex flex-col gap-1">
          <button v-for="tab in context.tabs" 
                  :key="tab.id"
                  @click="context.setActive(tab.id)"
                  class="flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-all relative border border-transparent w-full text-left"
                  :class="[
                    context.activeTab === tab.id ? 
                    'bg-[#37373D] text-white font-bold border-neutral-700 shadow-sm shadow-black/20' : 
                    'text-neutral-500 hover:bg-neutral-800/80 hover:text-neutral-300'
                  ]">
            <div v-if="tab.icon" class="flex-shrink-0 flex items-center justify-center w-4 h-4" :class="context.activeTab === tab.id ? 'text-blue-400' : 'text-neutral-500'">
              <Icon :icon="tab.icon" />
            </div>
            <span class="truncate">{{ tab.label }}</span>
          </button>
        </div>
      </SimpleBar>

      <template v-else>
        <button v-for="tab in context.tabs" 
                :key="tab.id"
                @click="context.setActive(tab.id)"
                class="flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-all relative border border-transparent h-full"
                :class="[
                  context.activeTab === tab.id ? 
                  'bg-[#37373D] text-white font-bold border-neutral-700 shadow-sm shadow-black/20' : 
                  'text-neutral-500 hover:bg-neutral-800/80 hover:text-neutral-300'
                ]">
          <div v-if="tab.icon" class="flex-shrink-0 flex items-center justify-center w-4 h-4" :class="context.activeTab === tab.id ? 'text-blue-400' : 'text-neutral-500'">
            <Icon :icon="tab.icon" />
          </div>
          <span class="truncate">{{ tab.label }}</span>
          <div v-if="context.activeTab === tab.id" class="absolute left-1.5 right-1.5 bottom-0 h-0.5 bg-blue-500"></div>
        </button>
      </template>

      <slot name="sidebar-footer"></slot>
    </div>

    <!-- Content Area -->
    <div class="flex-1 min-w-0 flex flex-col overflow-hidden relative h-full">
      <!-- We use a scoped slot passing the context so the parent can access activeTabLabel easily if it wants -->
      <slot :activeTabLabel="activeTabLabel" :activeTab="context.activeTab"></slot>
    </div>
  </div>
</template>

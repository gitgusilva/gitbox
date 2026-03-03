<script setup lang="ts">
import { inject, onMounted, onUnmounted, computed, watch } from 'vue';

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: false
  }
});

const context = inject<{ 
  activeTab: string | undefined, 
  register: (id: string, label: string, icon?: string) => void, 
  unregister: (id: string) => void,
  update: (id: string, label: string, icon?: string) => void
}>('tabs-context');

if (!context) {
  throw new Error('Tab component must be placed within a Tabs container.');
}

onMounted(() => {
  context.register(props.id, props.label, props.icon);
});

onUnmounted(() => {
  context.unregister(props.id);
});

watch(() => [props.label, props.icon], () => {
  if (context.update) {
    context.update(props.id, props.label, props.icon);
  }
}, { deep: true });

const isActive = computed(() => context.activeTab === props.id);
</script>

<template>
  <div v-show="isActive" class="h-full w-full overflow-hidden content-tab">
    <slot></slot>
  </div>
</template>

<style scoped>
.content-tab {
    animation: fade-tab 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes fade-tab {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>

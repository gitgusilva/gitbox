<script setup lang="ts">
import { inject, onMounted, onUnmounted, computed, watch, unref, ref, Ref } from 'vue';
import { cn } from '../../utils/cn';

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
  activeTab: Ref<string | undefined> | string | undefined, 
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

const isActive = computed(() => unref(context.activeTab) === props.id);

// Lazy-mount: don't render (and run onMounted side effects of) a tab's content
// until it is first activated. Once shown, keep it mounted (v-show) so switching
// back is instant and in-tab state survives. This stops every Settings section
// — including the heavy AI-CLI discovery — from mounting on every modal open.
const hasBeenActive = ref(false);
watch(isActive, (v) => { if (v) hasBeenActive.value = true; }, { immediate: true });
</script>

<template>
  <!-- Registration-only tabs (no content of their own — the parent renders one
       shared panel for every tab, as the Command Log does) must render NOTHING:
       an empty `h-full` wrapper still takes the whole content area in block flow
       and pushes the parent's shared panel out of the clipped region. -->
  <div v-if="$slots.default" v-show="isActive" :class="cn('h-full w-full overflow-hidden content-tab')">
    <slot v-if="hasBeenActive"></slot>
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

<script setup lang="ts" generic="T">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useVirtualList } from '@vueuse/core';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  items: T[];
  itemHeight: number | ((index: number, data: T) => number);
  overscan?: number;
  autoHide?: boolean;
}>(), {
  overscan: 10,
  autoHide: true,
});

const scrollContainer = ref<any>(null);
const containerRef = ref<HTMLElement | null>(null);

const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
  computed(() => props.items),
  {
    itemHeight: (index) => {
      if (typeof props.itemHeight === 'function') {
        const item = props.items[index];
        if (!item) return 28;
        return (props.itemHeight as Function)(index, item);
      }
      return props.itemHeight;
    },
    overscan: props.overscan,
  }
);

// Synchronize SimpleBar with useVirtualList
function handleSimpleBarRef(el: any) {
  scrollContainer.value = el;
  if (!el) return;

  const scrollEl = el.SimpleBar?.getScrollElement() || 
                   el.$el?.querySelector('.simplebar-content-wrapper') ||
                   (typeof el.getScrollElement === 'function' && el.getScrollElement());

  if (scrollEl) {
    containerRef.value = scrollEl;
    (containerProps.ref as any).value = scrollEl; // Wired container
    
    // Wire scroll events
    scrollEl.addEventListener('scroll', containerProps.onScroll, { passive: true });
  }
}

// Force recalculation when the items array reference or length changes.
// (Deep-watching a 2000+ item list traverses every element on every change.)
watch(() => props.items.length, () => {
  if (scrollContainer.value?.SimpleBar) {
    setTimeout(() => {
        scrollContainer.value.SimpleBar.recalculate();
    }, 0);
  }
});

// Recalculate SimpleBar on container resize
let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
        if (scrollContainer.value?.SimpleBar) {
            scrollContainer.value.SimpleBar.recalculate();
        }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

function calculateHeight(index: number, data: T) {
   if (typeof props.itemHeight === 'function') {
       return (props.itemHeight as Function)(index, data);
   }
   return props.itemHeight;
}

defineExpose({ scrollTo, list });
</script>

<template>
  <SimpleBar
    v-bind="$attrs"
    :ref="handleSimpleBarRef"
    :auto-hide="autoHide"
    class="outline-none h-full w-full"
  >
    <!-- Use standard padding/margin flow from useVirtualList -->
    <div :style="wrapperProps.style">
      <div v-for="item in list" 
           :key="item.index" 
           :style="{
             height: `${calculateHeight(item.index, item.data)}px`,
             overflow: 'hidden',
             display: 'block'
           }">
        <slot :item="item" :index="item.index" />
      </div>
    </div>
  </SimpleBar>
</template>

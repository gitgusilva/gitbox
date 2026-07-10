<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step?: number;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: number): void;
}>();

const progressPercent = computed(() => {
    return ((props.modelValue - props.min) / (props.max - props.min)) * 100;
});

function onInput(event: Event) {
    const target = event.target as HTMLInputElement;
    emit('update:modelValue', Number(target.value));
}
</script>

<template>
  <div class="range-slider-wrapper relative w-full flex flex-col min-h-[1.5rem] px-1.5">
    <div class="range-slider-container relative w-full flex items-center h-4">
      <!-- Custom Track Background -->
      <div class="absolute w-full h-[3px] bg-line rounded-full overflow-hidden pointer-events-none">
          <!-- Progress Bar (color of the dot) -->
          <div class="h-full bg-accent" :style="{ width: `${progressPercent}%` }"></div>
      </div>
      
      <!-- Actual Range Input -->
      <input 
        type="range" 
        :value="modelValue" 
        :min="min" 
        :max="max" 
        :step="step || 1"
        @input="onInput"
        class="w-full absolute inset-0 opacity-0 cursor-pointer h-full z-20 m-0 p-0" 
      />
      
      <!-- Custom Thumb (Dot) - smaller -->
      <div 
          class="absolute w-2.5 h-2.5 bg-accent rounded-full shadow-md pointer-events-none transform -translate-x-1/2 -translate-y-1/2 top-1/2 z-10"
          :style="{ left: `${progressPercent}%` }"
      ></div>
    </div>
    <div class="w-full">
      <slot></slot>
    </div>
  </div>
</template>

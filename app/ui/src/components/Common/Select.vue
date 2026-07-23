<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { Icon } from '@iconify/vue';
import ScrollArea from './ScrollArea.vue';
import { calculateFloatingPosition } from '../../utils/floating';
import { useI18n } from 'vue-i18n';
import { cn } from '../../utils/cn';

/**
 * Component to handle single or multiple selection from a list of options.
 * Supports searching, custom values (creatable), and icons.
 */
interface Option {
  value: string;
  label: string;
  icon?: string;
}

const { t } = useI18n();

/**
 * @property {Option[]} options - List of available options.
 * @property {string | string[]} modelValue - The currently selected value(s).
 * @property {string} [placeholder] - Helpful text when no value is selected.
 * @property {string} [icon] - Icon to display on the left side of the selector.
 * @property {boolean} [searchable] - Whether the user can search through options.
 * @property {boolean} [creatable] - Whether the user can enter custom values.
 * @property {boolean} [multiple] - Whether multiple items can be selected.
 * @property {string} [class] - Custom CSS class for the container.
 */
const props = defineProps<{
  options: Option[];
  modelValue: string | string[];
  placeholder?: string;
  icon?: string;
  searchable?: boolean;
  creatable?: boolean;
  multiple?: boolean;
  class?: string;
}>();

const emit = defineEmits<{
  /** Emitted when the selection changes. */
  (e: 'update:modelValue', val: string | string[]): void;
}>();

const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' });
const searchQuery = ref('');

/**
 * Syncs the search query with the current selection's label. Watches the options
 * too, not just the value: when options arrive asynchronously (e.g. a list still
 * loading over IPC) the selected value can't be resolved to a label on first
 * render, so it would otherwise show raw until the user clicked to force a
 * re-sync. Skipped while the dropdown is open so it never clobbers what the user
 * is typing.
 */
watch([() => props.modelValue, () => props.options], ([newVal]) => {
    if (props.searchable || props.creatable) {
        if (!isOpen.value && !props.multiple) {
           const opt = props.options?.find(o => o.value === newVal);
           searchQuery.value = opt ? opt.label : (newVal as string || '');
        }
    }
}, { immediate: true });

watch(searchQuery, (newVal) => {
    if (props.creatable && isOpen.value) {
        emit('update:modelValue', newVal);
    }
});

/**
 * Calculates and updates the floating dropdown position.
 */
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

/**
 * Opens the dropdown and focuses the input if present. The input is only focused
 * (not select-all'd) — highlighting the whole text on open looked like an
 * accidental selection and let a stray keystroke wipe the field.
 */
function openDropdown() {
  isOpen.value = true;
  nextTick(() => {
      updatePosition();
      if (inputRef.value) {
          inputRef.value.focus();
      }
  });
}

/**
 * Toggles the dropdown open/closed state.
 */
function toggleDropdown() {
  if (isOpen.value) {
      isOpen.value = false;
  } else {
      openDropdown();
  }
}

/**
 * Closes the dropdown if the target is outside the component.
 */
function closeDropdown(e?: MouseEvent) {
  if (e) {
    const isInsideContainer = containerRef.value?.contains(e.target as Node);
    const isInsideDropdown = dropdownRef.value?.contains(e.target as Node);
    if (isInsideContainer || isInsideDropdown) return;
  }
  
  isOpen.value = false;
  
  if ((props.searchable || props.creatable) && !props.multiple) {
      // Re-sync input with model value on blur just in case
      const opt = props.options?.find(o => o.value === props.modelValue);
      searchQuery.value = opt ? opt.label : (props.modelValue as string || '');
  }
}

/** Nearest scrollable ancestor of the trigger (the modal body, a panel, …). */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement || null;
  while (node) {
    const s = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(s.overflowY + s.overflowX + s.overflow)) return node;
    node = node.parentElement;
  }
  return null;
}

/** True while the trigger is still visible within the viewport AND its scroll container. */
function isTriggerVisible(): boolean {
  if (!containerRef.value) return false;
  const r = containerRef.value.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false;
  const sp = getScrollParent(containerRef.value);
  if (sp) {
    const s = sp.getBoundingClientRect();
    if (r.bottom <= s.top || r.top >= s.bottom || r.right <= s.left || r.left >= s.right) return false;
  }
  return true;
}

// The dropdown is teleported to <body>. Keep it glued to the trigger as ancestors
// scroll (reactive), but hide it once the trigger scrolls out of view — otherwise
// it floats, orphaned, over unrelated content. Scrolling the dropdown's own option
// list must NOT trigger this.
function onOuterScroll(e: Event) {
  if (!isOpen.value) return;
  const target = e.target as Node | null;
  if (target && dropdownRef.value?.contains(target)) return;
  if (!isTriggerVisible()) {
    isOpen.value = false;
    return;
  }
  updatePosition();
}

onMounted(() => {
  document.addEventListener('mousedown', closeDropdown as EventListener);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', onOuterScroll, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', closeDropdown as EventListener);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', onOuterScroll, true);
});

/**
 * Handles option selection and updates the model value.
 */
function selectOption(val: string) {
  if (props.multiple) {
      const current = Array.isArray(props.modelValue) ? [...props.modelValue] : [];
      const index = current.indexOf(val);

      if (index > -1) {
          current.splice(index, 1);
      } else {
          current.push(val);
      }

      emit('update:modelValue', current);
      // Keep dropdown open for multiple selection
  } else {
      emit('update:modelValue', val);
      if (props.creatable || props.searchable) {
          const opt = props.options?.find(o => o.value === val);
          searchQuery.value = opt ? opt.label : val;
      }
      isOpen.value = false;
  }
}

/**
 * Filtered options based on search query.
 */
const filteredOptions = computed(() => {
    if (!props.searchable && !props.creatable) return props.options;
    
    if (!props.multiple && props.modelValue) {
        const selectedOpt = props.options.find(o => o.value === props.modelValue);
        if (selectedOpt && searchQuery.value === selectedOpt.label) {
            return props.options;
        }
    }

    if (!searchQuery.value) return props.options;
    
    const lowerQ = searchQuery.value.toLowerCase();
    return props.options.filter(o => 
        o.label.toLowerCase().includes(lowerQ) || 
        o.value.toLowerCase().includes(lowerQ)
    );
});

/**
 * Computed label to display in the selector button.
 */
const displayLabel = computed(() => {
  if (props.multiple) {
      const arr = Array.isArray(props.modelValue) ? props.modelValue : [];
      
      if (arr.length === 0) return props.placeholder || t('common.select') || 'Select...';
      if (arr.length === 1) {
          const opt = props.options.find(o => o.value === arr[0]);
          return opt ? opt.label : arr[0];
      }

      return `${arr.length} ${t('common.items_selected') || 'items selected'}`;
  } else {
      if (!props.modelValue) return props.placeholder || t('common.select') || 'Select...';
      const opt = props.options.find(o => o.value === props.modelValue);
      return opt ? opt.label : props.modelValue;
  }
});

/**
 * Indicates if the user is typing a new custom record.
 */
const isCreatingNew = computed(() => {
   if (!props.creatable) return false;
   if (!searchQuery.value) return false;
   return !props.options.some(o => o.value === searchQuery.value);
});

</script>

<template>
  <div :class="cn('relative group/select w-full', props.class)" ref="containerRef">
    <!-- Creatable or Searchable Input Base -->
    <div v-if="searchable || creatable" 
         class="relative w-full">
         
         <input ref="inputRef" 
                v-model="searchQuery" 
                @focus="openDropdown"
                spellcheck="false"
                 :placeholder="placeholder || t('common.search') || 'Search...'" 
                 :class="cn(
                    'w-full bg-surface border rounded-lg py-2 text-xs text-content-strong outline-none focus:border-accent transition-all shadow-inner',
                    isOpen ? 'border-accent' : 'border-neutral-300/50 dark:border-neutral-700/50',
                    icon ? 'pl-9 pr-8' : 'px-3 pr-8'
                 )" />
                
         <Icon v-if="icon" :icon="icon" class="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />

         <!-- Visual suffix decorators -->
         <Icon v-if="isOpen && !creatable" icon="lucide:search" class="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
         <Icon v-else-if="!isOpen" icon="lucide:chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none transition-transform" />
         
         <!-- Slot right bound (e.g for 'NEW' tags) -->
         <div class="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
             <slot name="suffix"></slot>
         </div>
    </div>
    
    <!-- Standard Select Base -->
    <div v-else 
         @click="toggleDropdown" 
         :class="cn(
             'h-stack w-full bg-surface border border-neutral-300/50 dark:border-neutral-700/50 rounded-lg py-2 text-xs text-content outline-none hover:border-neutral-600 focus:border-accent cursor-pointer transition-all select-none',
             icon ? 'pl-9 pr-3' : 'px-3'
         )">
         
       <Icon v-if="icon" :icon="icon" class="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />

       <span class="truncate pr-4 flex-1 text-content-strong text-[11px]">{{ displayLabel }}</span>
       <Icon icon="lucide:chevron-down" class="text-neutral-600 flex-shrink-0 transition-transform" :class="isOpen ? 'rotate-180' : ''" />
    </div>
    
    <!-- Dropdown Core -->
    <Teleport to="body">
      <div v-if="isOpen && filteredOptions.length > 0" ref="dropdownRef"
           :class="cn('fixed bg-surface border border-line-strong rounded shadow-2xl z-[99999] flex flex-col overflow-hidden max-h-48')"
           :style="dropdownStyle">
         <ScrollArea class="flex-1 w-full p-1 h-full max-h-48">
            <div class="v-stack gap-0.5">
              <div v-for="opt in filteredOptions" :key="opt.value" 
                   @click="selectOption(opt.value)"
                   :class="cn(
                     'h-stack gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
                     (multiple ? (Array.isArray(modelValue) && modelValue.includes(opt.value)) : modelValue === opt.value) 
                       ? (multiple ? 'bg-surface-hover' : 'bg-accent text-accent-fg')
                       : 'hover:bg-neutral-200 dark:hover:bg-[#3D3D3D] text-content hover:text-neutral-900 dark:hover:text-white'
                   )">
                
                <!-- Checkbox visual for multiple -->
                <div v-if="multiple" 
                     :class="cn(
                        'center w-3 h-3 rounded border transition-colors flex-shrink-0',
                        (Array.isArray(modelValue) && modelValue.includes(opt.value)) ? 'bg-accent border-accent' : 'bg-transparent border-neutral-600'
                     )">
                    <Icon v-if="(Array.isArray(modelValue) && modelValue.includes(opt.value))" icon="lucide:check" class="text-[8px] text-white" />
                </div>

                <Icon v-if="opt.icon" :icon="opt.icon" 
                      :class="cn(
                        'text-[12px] opacity-70 flex-shrink-0',
                        (multiple ? (Array.isArray(modelValue) && modelValue.includes(opt.value)) : modelValue === opt.value) ? 'text-white' : ''
                      )" />
                <span :class="cn(
                    'text-[11px] truncate transition-colors',
                    (multiple ? (Array.isArray(modelValue) && modelValue.includes(opt.value)) : modelValue === opt.value) ? 'text-white' : ''
                )">
                   {{ opt.label }}
                </span>
                
                <Icon v-if="!multiple && modelValue === opt.value" icon="lucide:check" class="text-[12px] text-white ml-auto" />
              </div>
            </div>
         </ScrollArea>
      </div>
    </Teleport>
  </div>
</template>

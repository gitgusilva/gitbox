<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  original: string;
  modified: string;
  filename?: string;
}>();

const { t } = useI18n();

function getMimeType(filename: string) {
    if (!filename) return 'image/png';
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'ico': return 'image/x-icon';
        case 'svg': return 'image/svg+xml';
        default: return 'image/png';
    }
}

const srcOriginal = computed(() => {
    if (!props.original) return '';
    if (props.original.startsWith('data:')) return props.original;
    const mime = getMimeType(props.filename || '');
    return `data:${mime};base64,${props.original}`;
});

const srcModified = computed(() => {
    if (!props.modified) return '';
    if (props.modified.startsWith('data:')) return props.modified;
    const mime = getMimeType(props.filename || '');
    return `data:${mime};base64,${props.modified}`;
});

const leftPane = ref<HTMLElement | null>(null);
const rightPane = ref<HTMLElement | null>(null);

let isSyncingLeft = false;
let isSyncingRight = false;

function onScrollLeft() {
    if (isSyncingLeft) {
        isSyncingLeft = false;
        return;
    }
    if (!leftPane.value || !rightPane.value) return;
    
    isSyncingRight = true;
    
    // Calculate percentage based on scrollable area
    const leftScrollable = leftPane.value.scrollHeight - leftPane.value.clientHeight;
    if (leftScrollable <= 0) return;
    
    const percentage = leftPane.value.scrollTop / leftScrollable;
    const rightScrollable = rightPane.value.scrollHeight - rightPane.value.clientHeight;
    
    rightPane.value.scrollTop = percentage * rightScrollable;
}

function onScrollRight() {
    if (isSyncingRight) {
        isSyncingRight = false;
        return;
    }
    if (!leftPane.value || !rightPane.value) return;
    
    isSyncingLeft = true;
    
    const rightScrollable = rightPane.value.scrollHeight - rightPane.value.clientHeight;
    if (rightScrollable <= 0) return;
    
    const percentage = rightPane.value.scrollTop / rightScrollable;
    const leftScrollable = leftPane.value.scrollHeight - leftPane.value.clientHeight;
    
    leftPane.value.scrollTop = percentage * leftScrollable;
}

</script>

<template>
    <div class="flex-1 flex flex-col md:flex-row bg-[#1e1e1e] overflow-auto gap-1 border-t border-neutral-800 checkerboard">
        <div class="flex flex-col w-full md:w-1/2 h-full min-h-[300px] bg-neutral-900 border-r border-neutral-800 relative">
            <div ref="leftPane" @scroll="onScrollLeft" class="p-6 flex-1 flex items-center justify-center bg-transparent overflow-auto">
                <img v-if="props.original" :src="srcOriginal" class="max-w-none max-h-none shadow-lg outline outline-1 outline-neutral-700 bg-black/50" />
                <div v-else class="text-neutral-600 font-bold uppercase tracking-widest text-[10px] h-full flex items-center justify-center">
                    {{ t('common.file_not_in_parent') }}
                </div>
            </div>
        </div>
        
        <div class="flex flex-col w-full md:w-1/2 h-full min-h-[300px] bg-neutral-900 relative">
            <div ref="rightPane" @scroll="onScrollRight" class="p-6 flex-1 flex items-center justify-center bg-transparent overflow-auto">
                <img v-if="props.modified" :src="srcModified" class="max-w-none max-h-none shadow-lg outline outline-1 outline-neutral-700 bg-black/50" />
                <div v-else class="text-neutral-600 font-bold uppercase tracking-widest text-[10px] h-full flex items-center justify-center">
                    {{ t('common.file_deleted') }}
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.checkerboard {
    background-image: linear-gradient(45deg, #222 25%, transparent 25%), 
                      linear-gradient(-45deg, #222 25%, transparent 25%), 
                      linear-gradient(45deg, transparent 75%, #222 75%), 
                      linear-gradient(-45deg, transparent 75%, #222 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
</style>

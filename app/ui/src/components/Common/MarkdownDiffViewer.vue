<script setup lang="ts">
import { computed, ref } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useI18n } from 'vue-i18n';
import { diffLines } from 'diff';

const props = defineProps<{
  original: string;
  modified: string;
  isInline?: boolean;
  isHunkView?: boolean;
}>();

const { t } = useI18n();

const leftPane = ref<HTMLElement | null>(null);
const rightPane = ref<HTMLElement | null>(null);

let isSyncingLeft = false;
let isSyncingRight = false;

function onScrollLeft() {
    if (props.isInline) return;
    if (isSyncingLeft) {
        isSyncingLeft = false;
        return;
    }
    if (!leftPane.value || !rightPane.value) return;
    
    isSyncingRight = true;
    const leftScrollable = leftPane.value.scrollHeight - leftPane.value.clientHeight;
    if (leftScrollable <= 0) return;
    
    const percentage = leftPane.value.scrollTop / leftScrollable;
    const rightScrollable = rightPane.value.scrollHeight - rightPane.value.clientHeight;
    rightPane.value.scrollTop = percentage * rightScrollable;
}

function onScrollRight() {
    if (props.isInline) return;
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

function renderMd(text: string) {
    if (!text) return '';
    const dirty = marked.parse(text);
    return DOMPurify.sanitize(dirty as string);
}

const diffRows = computed(() => {
    const changes = diffLines(props.original || '', props.modified || '');
    const rows = [];
    
    let leftLineNumber = 1;
    let rightLineNumber = 1;
    
    for (let i = 0; i < changes.length; i++) {
        const chunk = changes[i];
        
        if (chunk.removed) {
            // Check if next is added (modification)
            if (i + 1 < changes.length && changes[i+1].added) {
                const nextChunk = changes[i+1];
                rows.push({
                    type: 'modified',
                    left: chunk.value,
                    right: nextChunk.value,
                    leftLine: leftLineNumber,
                    rightLine: rightLineNumber,
                    leftCount: chunk.count || 0,
                    rightCount: nextChunk.count || 0
                });
                leftLineNumber += chunk.count || 0;
                rightLineNumber += nextChunk.count || 0;
                i++; // skip next
            } else {
                rows.push({
                    type: 'removed',
                    left: chunk.value,
                    right: '',
                    leftLine: leftLineNumber,
                    rightLine: null,
                    leftCount: chunk.count || 0,
                    rightCount: 0
                });
                leftLineNumber += chunk.count || 0;
            }
        } else if (chunk.added) {
            rows.push({
                type: 'added',
                left: '',
                right: chunk.value,
                leftLine: null,
                rightLine: rightLineNumber,
                leftCount: 0,
                rightCount: chunk.count || 0
            });
            rightLineNumber += chunk.count || 0;
        } else {
            rows.push({
                type: 'unchanged',
                left: chunk.value,
                right: chunk.value,
                leftLine: leftLineNumber,
                rightLine: rightLineNumber,
                leftCount: chunk.count || 0,
                rightCount: chunk.count || 0
            });
            leftLineNumber += chunk.count || 0;
            rightLineNumber += chunk.count || 0;
        }
    }
    
    if (props.isHunkView) {
        return rows.filter(r => r.type !== 'unchanged');
    }
    
    return rows;
});

</script>

<template>
    <div class="flex-1 flex flex-col bg-app overflow-hidden gap-1 border-t border-line">
        
        <!-- INLINE VIEW -->
        <div v-if="props.isInline" class="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900 border-r border-line relative">
            <div class="p-6 text-content prose prose-invert prose-sm max-w-none flex flex-col gap-2">
                <template v-for="(row, idx) in diffRows" :key="idx">
                    <!-- Unchanged -->
                    <div v-if="row.type === 'unchanged'" class="flex gap-4 opacity-70">
                        <div class="w-16 flex-shrink-0 text-right text-xs text-neutral-500 font-mono py-2 opacity-50">{{ row.leftLine }} &nbsp; {{ row.rightLine }}</div>
                        <div class="flex-1 py-1" v-html="renderMd(row.left)"></div>
                    </div>
                    
                    <!-- Added -->
                    <div v-else-if="row.type === 'added'" class="flex gap-4 bg-green-900/10 border-l-[3px] border-green-500 -ml-[2px]">
                        <div class="w-16 flex-shrink-0 text-right text-xs text-green-600/50 font-mono py-2 bg-green-900/20 pr-2">+ &nbsp; {{ row.rightLine }}</div>
                        <div class="flex-1 py-1 pr-4" v-html="renderMd(row.right)"></div>
                    </div>
                    
                    <!-- Removed -->
                    <div v-else-if="row.type === 'removed'" class="flex gap-4 bg-red-900/10 border-l-[3px] border-red-500 -ml-[2px]">
                        <div class="w-16 flex-shrink-0 text-right text-xs text-red-600/50 font-mono py-2 bg-red-900/20 pr-2">{{ row.leftLine }} &nbsp; -</div>
                        <div class="flex-1 py-1 pr-4" v-html="renderMd(row.left)"></div>
                    </div>
                    
                    <!-- Modified -->
                    <template v-else-if="row.type === 'modified'">
                        <div class="flex gap-4 bg-red-900/10 border-l-[3px] border-red-500 -ml-[2px]">
                           <div class="w-16 flex-shrink-0 text-right text-xs text-red-600/50 font-mono py-2 bg-red-900/20 pr-2">{{ row.leftLine }} &nbsp; -</div>
                           <div class="flex-1 py-1 pr-4" v-html="renderMd(row.left)"></div>
                        </div>
                        <div class="flex gap-4 bg-green-900/10 border-l-[3px] border-green-500 -ml-[2px] mt-1">
                           <div class="w-16 flex-shrink-0 text-right text-xs text-green-600/50 font-mono py-2 bg-green-900/20 pr-2">+ &nbsp; {{ row.rightLine }}</div>
                           <div class="flex-1 py-1 pr-4" v-html="renderMd(row.right)"></div>
                        </div>
                    </template>
                </template>
                
                <div v-if="diffRows.length === 0" class="text-neutral-600 font-bold uppercase tracking-widest text-[10px] h-full flex items-center justify-center p-12">
                    {{ t('common.no_changes') }}
                </div>
            </div>
        </div>

        <!-- SIDE-BY-SIDE VIEW -->
        <div v-else class="flex-1 flex flex-row overflow-hidden">
            <div class="flex flex-col w-1/2 h-full bg-neutral-100 dark:bg-neutral-900 border-r border-line relative">
                <div ref="leftPane" @scroll="onScrollLeft" class="text-content prose prose-invert prose-sm max-w-none flex-1 overflow-auto flex flex-col gap-1 py-6">
                    <template v-for="(row, idx) in diffRows" :key="idx">
                        <div class="flex gap-4 pl-2 group" :class="{ 'opacity-70': row.type === 'unchanged', 'bg-red-900/10 border-l-[3px] border-red-500 !pl-[5px]': row.type === 'removed' || row.type === 'modified', 'bg-transparent border-l-[3px] border-transparent !pl-[5px] opacity-0 select-none': row.type === 'added' }">
                           <div class="w-10 flex-shrink-0 text-right text-xs font-mono py-2 opacity-30 select-none" :class="{ '!opacity-70 text-red-500': row.type === 'removed' || row.type === 'modified', 'opacity-0': row.type === 'added' }">{{ row.leftLine || ' ' }}</div>
                           <div class="flex-1 py-1 pr-6" v-html="renderMd(row.type === 'added' ? row.right : row.left)"></div>
                        </div>
                    </template>
                </div>
            </div>
            
            <div class="flex flex-col w-1/2 h-full bg-neutral-100 dark:bg-neutral-900 relative">
                <div ref="rightPane" @scroll="onScrollRight" class="text-content prose prose-invert prose-sm max-w-none flex-1 overflow-auto flex flex-col gap-1 py-6">
                    <template v-for="(row, idx) in diffRows" :key="idx">
                        <div class="flex gap-4 pl-2 group" :class="{ 'opacity-70': row.type === 'unchanged', 'bg-green-900/10 border-l-[3px] border-green-500 !pl-[5px]': row.type === 'added' || row.type === 'modified', 'bg-transparent border-l-[3px] border-transparent !pl-[5px] opacity-0 select-none': row.type === 'removed' }">
                           <div class="w-10 flex-shrink-0 text-right text-xs font-mono py-2 opacity-30 select-none" :class="{ '!opacity-70 text-green-500': row.type === 'added' || row.type === 'modified', 'opacity-0': row.type === 'removed' }">{{ row.rightLine || ' ' }}</div>
                           <div class="flex-1 py-1 pr-6" v-html="renderMd(row.type === 'removed' ? row.left : row.right)"></div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
        
    </div>
</template>

<style>
/* Base overrides for our internal prose block sizes so they look neat */
.prose-sm pre { background-color: rgba(0,0,0,0.3) !important; padding: 10px; border-radius: 6px; }
.prose-sm p { margin-top: 0.5em; margin-bottom: 0.5em; }
</style>

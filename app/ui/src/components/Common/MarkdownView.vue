<script setup lang="ts">
import { computed, ref } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ImageLightbox from './ImageLightbox.vue';
import { handleLinkClick } from '../../utils/formatters';

/**
 * Renders untrusted markdown (PR bodies, comments, release notes) with the
 * house rules applied once, in one place: sanitized HTML, links handed to the
 * OS browser instead of navigating the app, and images that open full size.
 */
const props = defineProps<{
    content?: string | null;
    /** Shown when there is nothing to render. */
    emptyText?: string;
}>();

const html = computed(() => {
    if (!props.content) return '';
    return DOMPurify.sanitize(marked.parse(props.content) as string);
});

const lightboxSrc = ref<string | null>(null);
const lightboxCaption = ref<string>('');

function onClick(event: MouseEvent) {
    const image = (event.target as HTMLElement)?.closest('img') as HTMLImageElement | null;
    // Checked before links: an image wrapped in a link should open the image,
    // which is what a click on a screenshot is asking for.
    if (image?.src) {
        event.preventDefault();
        event.stopPropagation();
        lightboxSrc.value = image.src;
        lightboxCaption.value = image.alt || '';
        return;
    }

    handleLinkClick(event);
}
</script>

<template>
    <div>
        <div v-if="html"
             class="prose prose-invert prose-sm max-w-none text-content prose-a:text-accent hover:prose-a:text-accent-hover prose-a:underline prose-a:underline-offset-2 prose-img:cursor-zoom-in prose-img:rounded prose-img:border prose-img:border-line"
             v-html="html"
             @click="onClick"></div>
        <div v-else-if="emptyText" class="text-content-muted italic text-sm">{{ emptyText }}</div>

        <ImageLightbox v-model="lightboxSrc" :caption="lightboxCaption" />
    </div>
</template>

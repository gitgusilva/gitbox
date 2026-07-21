<script setup lang="ts">
/**
 * Back-to-top affordance. The scroll is deliberately unhurried (~1.1s with an
 * ease-in-out curve) so the page reads as travelling rather than teleporting;
 * `scroll-behavior: smooth` alone is too abrupt over a long page.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const visible = ref(false);
const THRESHOLD = 600;

function onScroll() {
    visible.value = window.scrollY > THRESHOLD;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function toTop() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        return;
    }

    const start = window.scrollY;
    const duration = 1100;
    let startedAt = 0;

    function frame(now: number) {
        if (!startedAt) startedAt = now;
        const progress = Math.min((now - startedAt) / duration, 1);
        // MUST be 'instant': the page sets `scroll-behavior: smooth` globally, so a
        // plain scrollTo makes the browser start its own smooth animation toward
        // each frame's target. Restarting that every ~16ms leaves the page frozen
        // for the whole run and then jumps to the end — which is exactly what a
        // plain scrollTo did here.
        window.scrollTo({ top: Math.round(start * (1 - easeInOut(progress))), behavior: 'instant' as ScrollBehavior });
        if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
});
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <Transition
    enter-active-class="transition duration-300" leave-active-class="transition duration-200"
    enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2"
  >
    <button
      v-if="visible"
      @click="toTop"
      :aria-label="t('common.back_to_top')"
      class="fixed bottom-6 right-6 z-40 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface/90 text-content shadow-lg shadow-black/40 backdrop-blur transition-colors hover:border-accent hover:text-strong"
    >
      <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

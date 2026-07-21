<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import Nav from './components/Nav.vue';
import GraphCanvas from './components/GraphCanvas.vue';
import Features from './components/Features.vue';
import Screenshots from './components/Screenshots.vue';
import Downloads from './components/Downloads.vue';
import SiteFooter from './components/SiteFooter.vue';
import BackToTop from './components/BackToTop.vue';
import { useLatestRelease } from './composables/useLatestRelease';
import { useI18n } from './i18n';
import { asset } from './asset';

const { version } = useLatestRelease();
const { t } = useI18n();

/** Fade sections in as they enter the viewport (CSS disables this for reduced motion). */
let observer: IntersectionObserver | null = null;

onMounted(() => {
    observer = new IntersectionObserver(
        entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer?.unobserve(entry.target);
                }
            }
        },
        { rootMargin: '0px 0px -10% 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => observer!.observe(el));
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div id="top">
    <Nav />

    <!-- Hero -->
    <section class="relative overflow-hidden pt-16">
      <!-- Animated commit graph, faded out behind the copy -->
      <!-- The graph is masked out behind the copy: lines crossing the headline
           read as noise, while the edges keep the motion visible. -->
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.42]"
        style="mask-image: radial-gradient(ellipse 55% 42% at 50% 42%, transparent 35%, #000 85%); -webkit-mask-image: radial-gradient(ellipse 55% 42% at 50% 42%, transparent 35%, #000 85%);"
      >
        <GraphCanvas />
      </div>
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/10 via-ink/55 to-ink"></div>

      <div class="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <a
          href="https://github.com/gitgusilva/gitbox/releases/latest"
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-[11px] font-medium text-muted backdrop-blur transition-colors hover:border-accent/50 hover:text-content"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
          <span v-if="version">{{ t('hero.badge_version', { version }) }}</span>
          <span v-else>{{ t('hero.badge_generic') }}</span>
        </a>

        <h1 class="mx-auto mt-8 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-strong sm:text-6xl">
          {{ t('hero.title_1') }}
          <span class="text-accent">{{ t('hero.title_2') }}</span>
        </h1>

        <p class="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted">
          {{ t('hero.subtitle') }}
        </p>

        <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#download"
            class="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-soft"
          >
            {{ t('hero.cta_download') }}
          </a>
          <a
            href="https://github.com/gitgusilva/gitbox"
            class="rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-content transition-colors hover:border-accent/50 hover:text-strong"
          >
            {{ t('hero.cta_source') }}
          </a>
        </div>

        <p class="mt-5 text-xs text-muted">{{ t('hero.note') }}</p>
      </div>

      <!-- Product showcase: the main screen centred with two supporting ones
           angled behind it. The side panels are decorative, so they're dropped
           below lg instead of being squeezed into a phone width. -->
      <div class="relative mx-auto w-full max-w-6xl px-6 pb-24 [perspective:2000px]">
        <div class="relative">
          <div
            class="absolute left-0 top-10 hidden w-[42%] overflow-hidden rounded-xl border border-line bg-surface opacity-60 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] [transform:rotateY(14deg)_rotateX(6deg)_scale(0.92)] lg:block"
            style="mask-image: linear-gradient(to bottom, #000 55%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);"
          >
            <img :src="asset('screenshots/statistics.png')" alt="" class="h-[300px] w-full object-cover object-top" />
          </div>

          <div
            class="absolute right-0 top-10 hidden w-[42%] overflow-hidden rounded-xl border border-line bg-surface opacity-60 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] [transform:rotateY(-14deg)_rotateX(6deg)_scale(0.92)] lg:block"
            style="mask-image: linear-gradient(to bottom, #000 55%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);"
          >
            <img :src="asset('screenshots/merge-editor.png')" alt="" class="h-[300px] w-full object-cover object-top" />
          </div>

          <div
            class="relative z-10 mx-auto w-full overflow-hidden rounded-xl border border-line bg-surface shadow-[0_40px_90px_-20px_rgba(0,0,0,0.9)] [transform:rotateX(7deg)] lg:w-[64%]"
            style="mask-image: linear-gradient(to bottom, #000 62%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, #000 62%, transparent 100%);"
          >
            <img
              :src="asset('screenshots/history.png')"
              :alt="t('hero.shot_alt')"
              class="h-[300px] w-full object-cover object-top sm:h-[420px]"
            />
          </div>
        </div>
      </div>

    </section>

    <Features />
    <Screenshots />
    <Downloads />
    <SiteFooter />
    <BackToTop />
  </div>
</template>

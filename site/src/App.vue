<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import Nav from './components/Nav.vue';
import GraphCanvas from './components/GraphCanvas.vue';
import Features from './components/Features.vue';
import Screenshots from './components/Screenshots.vue';
import Downloads from './components/Downloads.vue';
import SiteFooter from './components/SiteFooter.vue';
import { useLatestRelease } from './composables/useLatestRelease';
import { asset } from './asset';

const { version } = useLatestRelease();

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
      <div class="pointer-events-none absolute inset-0 opacity-[0.42]">
        <GraphCanvas />
      </div>
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/10 via-ink/55 to-ink"></div>

      <div class="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <a
          href="https://github.com/gitgusilva/gitbox/releases/latest"
          class="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-4 py-1.5 text-[11px] font-medium text-muted backdrop-blur transition-colors hover:border-accent/50 hover:text-content"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-accent"></span>
          <span v-if="version">{{ version }} is out — projects, faster history and more</span>
          <span v-else>Now with projects, faster history and more</span>
        </a>

        <h1 class="mx-auto mt-8 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-strong sm:text-6xl">
          A Git client that keeps up
          <span class="text-accent">with you</span>
        </h1>

        <p class="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted">
          GitBox drives Git through a native libgit2 addon instead of shelling out — so history,
          diffs and branch switching feel instant, even on repositories with thousands of commits.
        </p>

        <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#download"
            class="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-soft"
          >
            Download for free
          </a>
          <a
            href="https://github.com/gitgusilva/gitbox"
            class="rounded-lg border border-line bg-surface px-6 py-3 text-sm font-semibold text-content transition-colors hover:border-accent/50 hover:text-strong"
          >
            View source
          </a>
        </div>

        <p class="mt-5 text-xs text-muted">Windows and Linux · MIT licensed · No account required</p>
      </div>

      <!-- Product shot -->
      <div class="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <div class="overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60">
          <img
            :src="asset('screenshots/history.png')"
            alt="GitBox showing a repository's commit graph"
            class="w-full"
          />
        </div>
      </div>
    </section>

    <Features />
    <Screenshots />
    <Downloads />
    <SiteFooter />
  </div>
</template>

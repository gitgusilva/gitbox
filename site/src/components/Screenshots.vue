<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { asset } from '../asset';

/**
 * Product gallery: a slider with the arrows overlaid on the shot itself (so they
 * stay reachable on small screens, where a header control scrolls out of view)
 * plus a thumbnail rail that previews each screen.
 *
 * Every shot comes from a synthetic demo repository with fictional authors —
 * never from a real one, so nothing private ships here.
 */
const shots = [
    {
        id: 'history',
        label: 'History',
        file: 'history.png',
        title: 'The commit graph, drawn properly',
        caption: 'Branch labels, tags and merge glyphs on a virtualized list that stays smooth at thousands of commits.',
    },
    {
        id: 'changes',
        label: 'Local changes',
        file: 'changes.png',
        title: 'Stage, review, commit',
        caption: 'A file tree of what changed with the diff right beside it, and the commit box always in reach.',
    },
    {
        id: 'conflicts',
        label: 'Conflicts',
        file: 'conflict-decide.png',
        title: 'Decide a conflict without leaving the app',
        caption: 'Both sides are laid out with their branch and commit, so you can keep one outright — or open the editor.',
    },
    {
        id: 'merge',
        label: 'Merge editor',
        file: 'merge-editor.png',
        title: 'A real three-pane merge editor',
        caption: 'Current, result and incoming side by side, with per-hunk actions and a live count of what is left.',
    },
    {
        id: 'projects',
        label: 'Projects',
        file: 'projects.png',
        title: 'Group repositories into projects',
        caption: 'Each project keeps its own tabs and colour; switching swaps the whole tab bar in one click.',
    },
    {
        id: 'stashes',
        label: 'Stashes',
        file: 'stashes.png',
        title: 'Stashes you can actually read',
        caption: 'Every stash with its branch, timestamp and contents, one click from being applied or dropped.',
    },
    {
        id: 'statistics',
        label: 'Statistics',
        file: 'statistics.png',
        title: 'Know your repository',
        caption: 'Commits, contributors, branches, size and churn, with the contribution split per developer.',
    },
    {
        id: 'settings',
        label: 'Settings',
        file: 'settings.png',
        title: 'Tuned to your taste',
        caption: 'Language, date format, polling, themes and external tools — all in one place.',
    },
    {
        id: 'log',
        label: 'Command log',
        file: 'commandlog.png',
        title: 'Nothing happens behind your back',
        caption: 'Every operation GitBox runs, with its output and duration, so you always know what it did.',
    },
];

const activeIndex = ref(0);
const current = computed(() => shots[activeIndex.value]);

const rail = ref<HTMLElement | null>(null);
const section = ref<HTMLElement | null>(null);

function go(index: number) {
    activeIndex.value = (index + shots.length) % shots.length;
}
const step = (delta: number) => go(activeIndex.value + delta);

/** Keeps the highlighted thumbnail in view when the slider advances on its own. */
watch(activeIndex, () => {
    const el = rail.value?.children[activeIndex.value] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
});

// Auto-advance while the visitor isn't interacting with the gallery. Paused on
// hover/focus, when the section is off-screen, and for reduced-motion users.
const AUTOPLAY_MS = 6000;
let timer: ReturnType<typeof setInterval> | null = null;
const engaged = ref(false);
let visible = false;
let io: IntersectionObserver | null = null;

function sync() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const shouldRun = visible && !engaged.value && !reduced;
    if (shouldRun && !timer) timer = setInterval(() => step(1), AUTOPLAY_MS);
    else if (!shouldRun && timer) { clearInterval(timer); timer = null; }
}

watch(engaged, sync);

onMounted(() => {
    io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.25 });
    if (section.value) io.observe(section.value);
});

onBeforeUnmount(() => {
    io?.disconnect();
    if (timer) clearInterval(timer);
});
</script>

<template>
  <section
    id="screenshots" ref="section" class="section"
    @mouseenter="engaged = true" @mouseleave="engaged = false"
    @focusin="engaged = true" @focusout="engaged = false"
  >
    <div class="mb-10 max-w-2xl">
      <p class="eyebrow">A look inside</p>
      <h2 class="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">Built for long sessions</h2>
      <p class="mt-4 text-sm leading-relaxed text-muted">
        Nine screens you will actually live in — not a landing-page mockup.
      </p>
    </div>

    <figure class="reveal">
      <!-- Fixed 16:10 stage (the app's own aspect): the container never resizes
           between slides, and any shot that isn't 16:10 is letterboxed rather
           than stretching the layout. -->
      <div class="group relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-ink shadow-2xl shadow-black/50">
        <img
          :key="current.id"
          :src="asset('screenshots/' + current.file)"
          :alt="current.title"
          class="h-full w-full object-contain"
        />

        <!-- Arrows ride on the shot so they stay put no matter the screen size -->
        <button
          @click="step(-1)" aria-label="Previous screenshot"
          class="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/80 text-lg text-content backdrop-blur transition-colors hover:border-accent hover:text-strong sm:left-4"
        >&#8249;</button>
        <button
          @click="step(1)" aria-label="Next screenshot"
          class="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/80 text-lg text-content backdrop-blur transition-colors hover:border-accent hover:text-strong sm:right-4"
        >&#8250;</button>

        <span class="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[10px] text-muted backdrop-blur">
          {{ activeIndex + 1 }}/{{ shots.length }}
        </span>

        <!-- Caption rides over the shot so the viewer height stays put between slides -->
        <figcaption class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/90 to-transparent px-4 pb-4 pt-14 sm:px-6 sm:pb-5">
          <span class="block text-sm font-semibold text-strong">{{ current.title }}</span>
          <span class="mt-1 hidden max-w-2xl text-xs leading-relaxed text-muted sm:block">{{ current.caption }}</span>
        </figcaption>
      </div>
    </figure>

    <!-- Thumbnail rail: scrolls without a visible scrollbar, since the arrows and
         the thumbnails themselves are the navigation. -->
    <div ref="rail" class="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
      <button
        v-for="(s, i) in shots" :key="s.id"
        @click="go(i)"
        class="group shrink-0 text-left transition-opacity"
        :class="i === activeIndex ? '' : 'opacity-55 hover:opacity-100'"
      >
        <span
          class="block w-32 overflow-hidden rounded-lg border transition-colors sm:w-36"
          :class="i === activeIndex ? 'border-accent' : 'border-line group-hover:border-accent/50'"
        >
          <img :src="asset('screenshots/' + s.file)" :alt="s.label" class="h-20 w-full object-cover object-left-top" loading="lazy" />
        </span>
        <span
          class="mt-1.5 block text-[11px] font-medium"
          :class="i === activeIndex ? 'text-accent' : 'text-muted group-hover:text-content'"
        >{{ s.label }}</span>
      </button>
    </div>
  </section>
</template>

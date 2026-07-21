<script setup lang="ts">
import { asset } from '../asset';
import { useI18n, type LocaleCode } from '../i18n';
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const { t, locale, setLocale, locales } = useI18n();

const scrolled = ref(false);
const onScroll = () => { scrolled.value = window.scrollY > 12; };

/** Compact dropdown — a row of buttons pushed the nav wider on every locale. */
const langOpen = ref(false);
const langRef = ref<HTMLElement | null>(null);

/** Slide-in drawer: below `sm` the links have nowhere to live in the bar. */
const menuOpen = ref(false);

function pick(code: LocaleCode) {
    setLocale(code);
    langOpen.value = false;
}

function onDocClick(e: MouseEvent) {
    if (langOpen.value && langRef.value && !langRef.value.contains(e.target as Node)) langOpen.value = false;
}
const onEsc = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    langOpen.value = false;
    menuOpen.value = false;
};

// The page must not scroll under an open drawer.
watch(menuOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
});

onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
});
onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
    document.body.style.overflow = '';
});
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
    :class="scrolled ? 'border-b border-line bg-ink/85 backdrop-blur' : 'border-b border-transparent'"
  >
    <nav class="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
      <a href="#top" class="flex items-center gap-2.5">
        <img :src="asset('logo.png')" alt="" class="h-7 w-7" />
        <span class="text-sm font-bold tracking-tight text-strong">GitBox</span>
      </a>

      <div class="ml-auto hidden items-center gap-6 sm:flex">
        <a href="#features" class="text-xs font-medium text-muted transition-colors hover:text-strong">{{ t('nav.features') }}</a>
        <a href="#screenshots" class="text-xs font-medium text-muted transition-colors hover:text-strong">{{ t('nav.screenshots') }}</a>
        <a href="https://github.com/gitgusilva/gitbox" class="text-xs font-medium text-muted transition-colors hover:text-strong">{{ t('nav.github') }}</a>
      </div>

      <!-- Language: a dropdown so adding locales never widens the bar -->
      <div ref="langRef" class="relative ml-auto sm:ml-0">
        <button
          @click="langOpen = !langOpen"
          :aria-label="t('common.language')"
          :aria-expanded="langOpen"
          class="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-[11px] font-bold text-muted transition-colors hover:border-accent/50 hover:text-content"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20" />
          </svg>
          {{ locales.find(l => l.code === locale)?.short }}
        </button>

        <Transition
          enter-active-class="transition duration-150" leave-active-class="transition duration-100"
          enter-from-class="opacity-0 -translate-y-1" leave-to-class="opacity-0 -translate-y-1"
        >
          <!-- bg-elevated, not bg-overlay: the latter is a token from the app's
               Tailwind config and Tailwind emits nothing for an unknown colour,
               which left this menu fully transparent. -->
          <ul v-if="langOpen" class="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-line bg-elevated py-1 shadow-xl shadow-black/50">
            <li v-for="l in locales" :key="l.code">
              <button
                @click="pick(l.code)"
                class="flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-2 text-xs transition-colors hover:bg-surface"
                :class="locale === l.code ? 'text-accent' : 'text-content'"
              >
                <span>{{ l.label }}</span>
                <span class="w-12 shrink-0 text-right font-mono text-[10px] opacity-60">{{ l.short }}</span>
              </button>
            </li>
          </ul>
        </Transition>
      </div>

      <a
        href="#download"
        class="hidden rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-soft sm:block"
      >
        {{ t('nav.download') }}
      </a>

      <!-- Hamburger (small screens only) -->
      <button
        @click="menuOpen = true"
        :aria-label="t('nav.menu')"
        :aria-expanded="menuOpen"
        class="rounded-lg border border-line bg-surface p-2 text-content transition-colors hover:border-accent/50 sm:hidden"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </nav>

    <!-- Mobile drawer -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-300" leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0" leave-to-class="opacity-0"
      >
        <div v-if="menuOpen" class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm sm:hidden" @click="menuOpen = false"></div>
      </Transition>

      <Transition
        enter-active-class="transition-transform duration-300 ease-out" leave-active-class="transition-transform duration-200 ease-in"
        enter-from-class="translate-x-full" leave-to-class="translate-x-full"
      >
        <aside
          v-if="menuOpen"
          class="fixed inset-y-0 right-0 z-[61] flex w-72 max-w-[85vw] flex-col border-l border-line bg-elevated shadow-2xl shadow-black/60 sm:hidden"
        >
          <div class="flex h-16 items-center justify-between border-b border-line px-5">
            <span class="text-sm font-bold text-strong">GitBox</span>
            <button @click="menuOpen = false" :aria-label="t('nav.close')" class="rounded-lg p-2 text-muted transition-colors hover:text-strong">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav class="flex flex-col gap-1 p-4">
            <a @click="menuOpen = false" href="#features" class="rounded-lg px-3 py-3 text-sm text-content transition-colors hover:bg-surface hover:text-strong">{{ t('nav.features') }}</a>
            <a @click="menuOpen = false" href="#screenshots" class="rounded-lg px-3 py-3 text-sm text-content transition-colors hover:bg-surface hover:text-strong">{{ t('nav.screenshots') }}</a>
            <a href="https://github.com/gitgusilva/gitbox" class="rounded-lg px-3 py-3 text-sm text-content transition-colors hover:bg-surface hover:text-strong">{{ t('nav.github') }}</a>
          </nav>

          <div class="mt-auto space-y-4 border-t border-line p-4">
            <div>
              <p class="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted">{{ t('common.language') }}</p>
              <div class="flex flex-col gap-1">
                <button
                  v-for="l in locales" :key="l.code"
                  @click="setLocale(l.code)"
                  class="flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-xs transition-colors hover:bg-surface"
                  :class="locale === l.code ? 'text-accent' : 'text-content'"
                >
                  <span>{{ l.label }}</span>
                  <span class="w-12 shrink-0 text-right font-mono text-[10px] opacity-60">{{ l.short }}</span>
                </button>
              </div>
            </div>

            <a
              @click="menuOpen = false"
              href="#download"
              class="block rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-soft"
            >
              {{ t('nav.download') }}
            </a>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </header>
</template>

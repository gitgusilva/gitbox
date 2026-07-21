<script setup lang="ts">
import { asset } from '../asset';
import { useI18n, type LocaleCode } from '../i18n';
import { ref, onMounted, onBeforeUnmount } from 'vue';

const { t, locale, setLocale, locales } = useI18n();

const scrolled = ref(false);
const onScroll = () => { scrolled.value = window.scrollY > 12; };

/** Compact dropdown — a row of buttons pushed the nav wider on every locale. */
const langOpen = ref(false);
const langRef = ref<HTMLElement | null>(null);

function pick(code: LocaleCode) {
    setLocale(code);
    langOpen.value = false;
}

function onDocClick(e: MouseEvent) {
    if (langOpen.value && langRef.value && !langRef.value.contains(e.target as Node)) langOpen.value = false;
}
const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') langOpen.value = false; };

onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
});
onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
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
          <ul v-if="langOpen" class="absolute right-0 top-full mt-2 w-36 overflow-hidden rounded-lg border border-line bg-overlay py-1 shadow-xl">
            <li v-for="l in locales" :key="l.code">
              <button
                @click="pick(l.code)"
                class="flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-surface"
                :class="locale === l.code ? 'text-accent' : 'text-content'"
              >
                <span>{{ l.label }}</span>
                <span class="font-mono text-[10px] opacity-60">{{ l.short }}</span>
              </button>
            </li>
          </ul>
        </Transition>
      </div>

      <a
        href="#download"
        class="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-soft"
      >
        {{ t('nav.download') }}
      </a>
    </nav>
  </header>
</template>

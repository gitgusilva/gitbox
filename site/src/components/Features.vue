<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

/** Copy lives in the locale files; only the icon stays here. */
const FEATURES = [
    { key: 'speed', icon: '⚡' },
    { key: 'history', icon: '🌳' },
    { key: 'projects', icon: '🗂️' },
    { key: 'diffs', icon: '📄' },
    { key: 'conflicts', icon: '🔀' },
    { key: 'terminal', icon: '▮' },
    { key: 'themes', icon: '🎨' },
    { key: 'keyboard', icon: '⌨️' },
    { key: 'tags', icon: '🏷️' },
    { key: 'prs', icon: '🔃' },
    { key: 'submodules', icon: '📦' },
    { key: 'stashes', icon: '🧰' },
];

const features = computed(() =>
    FEATURES.map(f => ({
        key: f.key,
        icon: f.icon,
        title: t(`features.${f.key}.title`),
        body: t(`features.${f.key}.body`),
    }))
);
</script>

<template>
  <section id="features" class="section">
    <div class="mb-12 max-w-2xl">
      <p class="eyebrow">{{ t('features.eyebrow') }}</p>
      <h2 class="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
        {{ t('features.title') }}
      </h2>
      <p class="mt-4 text-sm leading-relaxed text-muted">{{ t('features.subtitle') }}</p>
    </div>

    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <article v-for="f in features" :key="f.key" class="card reveal">
        <div class="text-xl leading-none">{{ f.icon }}</div>
        <h3 class="mt-4 text-sm font-bold text-strong">{{ f.title }}</h3>
        <p class="mt-2 text-[13px] leading-relaxed text-muted">{{ f.body }}</p>
      </article>
    </div>
  </section>
</template>

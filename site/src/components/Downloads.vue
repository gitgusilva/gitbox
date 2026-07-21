<script setup lang="ts">
import { computed } from 'vue';
import { useLatestRelease, retryLatestRelease, detectPlatform, LATEST_URL, RELEASES_URL } from '../composables/useLatestRelease';
import { useI18n } from '../i18n';

const { version, windows, linux, failed, loading } = useLatestRelease();
const { t } = useI18n();
const platform = detectPlatform();

/** The visitor's own platform is listed first — that is the button they want. */
const columns = computed(() => {
    const cols = [
        { id: 'linux', title: 'Linux', icon: '🐧', options: linux.value },
        { id: 'windows', title: 'Windows', icon: '⊞', options: windows.value },
    ];
    return platform === 'windows' ? cols.reverse() : cols;
});
</script>

<template>
  <section id="download" class="section">
    <div class="mb-12 text-center">
      <p class="eyebrow">{{ t('downloads.eyebrow') }}</p>
      <h2 class="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
        {{ t('downloads.title') }}
        <span v-if="version" class="text-accent">{{ version }}</span>
      </h2>
      <p class="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
        {{ t('downloads.subtitle') }}
      </p>
    </div>

    <div v-if="loading" class="grid gap-6 sm:grid-cols-2">
      <div v-for="n in 2" :key="n" class="card animate-pulse">
        <div class="h-4 w-24 rounded bg-elevated"></div>
        <div class="mt-6 space-y-3">
          <div v-for="i in 3" :key="i" class="h-12 rounded bg-elevated"></div>
        </div>
      </div>
    </div>

    <!-- The release page always resolves, even when the API is rate-limited. -->
    <div v-else-if="failed" class="card text-center">
      <p class="text-sm text-content">{{ t('downloads.failed') }}</p>
      <p class="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
        {{ t('downloads.failed_hint') }}
      </p>
      <div class="mt-5 flex flex-wrap items-center justify-center gap-3">
        <a :href="LATEST_URL" class="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-soft">
          {{ t('downloads.open_release') }}
        </a>
        <button @click="retryLatestRelease()" class="rounded-lg border border-line bg-elevated px-5 py-3 text-sm font-semibold text-content transition-colors hover:border-accent/50 hover:text-strong">
          {{ t('downloads.retry') }}
        </button>
      </div>
    </div>

    <div v-else class="grid gap-6 sm:grid-cols-2">
      <div v-for="col in columns" :key="col.id" class="card">
        <div class="flex items-center gap-2">
          <span class="text-lg leading-none">{{ col.icon }}</span>
          <h3 class="text-sm font-bold uppercase tracking-widest text-strong">{{ col.title }}</h3>
          <span v-if="platform === col.id" class="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
            {{ t('downloads.your_system') }}
          </span>
        </div>

        <ul class="mt-5 space-y-2">
          <li v-for="opt in col.options" :key="opt.url">
            <a
              :href="opt.url"
              class="group flex items-center justify-between gap-4 rounded-lg border border-line bg-elevated px-4 py-3 transition-colors hover:border-accent hover:bg-accent/10"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-strong">{{ t('downloads.' + opt.key + '.label') }}</span>
                <span class="block truncate text-[11px] text-muted">{{ t('downloads.' + opt.key + '.hint') }}</span>
              </span>
              <span class="shrink-0 font-mono text-[11px] text-muted group-hover:text-accent">{{ opt.size }}</span>
            </a>
          </li>
        </ul>
      </div>
    </div>

    <p class="mt-8 text-center text-xs text-muted">
      {{ t('downloads.older') }}
      <a :href="RELEASES_URL" class="text-accent hover:underline">{{ t('downloads.browse') }}</a>.
      {{ t('downloads.no_mac') }}
    </p>
  </section>
</template>

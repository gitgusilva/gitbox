<script setup lang="ts">
import { onMounted } from 'vue';
import { loadRepoData, startPolling } from './services/gitService';
import { loadAppVersion, initUpdater, checkForUpdates, checkWhatsNew } from './services/versionService';
import { generalSettings } from './services/settingsService';
import { useTheme } from './services/themeService';
import AppLayout from './layouts/AppLayout.vue';
import DashboardView from './layouts/DashboardView.vue';
// Imported for its side effect: subscribes to the main process' git command log.
import './services/logService';

const { currentTheme, applyTheme } = useTheme();

onMounted(() => {
  // Initialize theme
  applyTheme(currentTheme.value);
  // The release notes are keyed on the running version, so the version has to be
  // known first — hence the chain rather than two independent calls.
  loadAppVersion().then(() => checkWhatsNew());

  // Native auto-updater: subscribe to download/install events, then (if the
  // user opted in) run a silent check on startup. On updatable builds the main
  // process auto-downloads and we toast "restart to install" when ready.
  initUpdater();
  if (generalSettings.value.checkForUpdates !== false) {
    setTimeout(() => { checkForUpdates(); }, 4000);
  }

  // NOTE: the `git:log-entry` subscription lives in services/logService.ts — a
  // second one here made every git command show up TWICE in the Command Log.

  if (window.gitbox && window.gitbox.onMergeResolved) {
      window.gitbox.onMergeResolved(() => {
          loadRepoData(true);
      });
  }

  loadRepoData(true);
  startPolling();
});
</script>

<template>
  <AppLayout>
    <DashboardView />
  </AppLayout>
</template>

<style>
/* Global SimpleBar overrides */
.simplebar-scrollbar::before { background: rgb(var(--gb-text-muted) / 0.45) !important; opacity: 1 !important; }
.simplebar-scrollbar.simplebar-visible::before { opacity: 1 !important; }
.simplebar-track.simplebar-vertical { width: 10px !important; }

/* Theme Transitions - Optimized to not use '*' selector */
body.initial-load * {
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.1s ease;
}

/* Light mode surfaces come from the design tokens (see style.css); the old
   `.light .bg-[#hex]` / `.light .text-neutral-*` override shim was removed once
   every component moved to the semantic token classes. */
.light body {
  background-color: rgb(var(--gb-bg));
  color: rgb(var(--gb-text));
}
</style>

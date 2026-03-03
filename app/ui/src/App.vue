<script setup lang="ts">
import { onMounted } from 'vue';
import { loadRepoData, startPolling } from './services/gitService';
import { useTheme } from './services/themeService';
import AppLayout from './layouts/AppLayout.vue';
import DashboardView from './layouts/DashboardView.vue';

const { currentTheme, applyTheme } = useTheme();

onMounted(() => {
  // Initialize theme
  applyTheme(currentTheme.value);
  
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
.simplebar-scrollbar::before { background: rgba(255, 255, 255, 0.2) !important; opacity: 1 !important; }
.simplebar-scrollbar.simplebar-visible::before { opacity: 1 !important; }
.simplebar-track.simplebar-vertical { width: 10px !important; }

/* Theme Transitions - Optimized to not use '*' selector */
body.initial-load * {
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.1s ease;
}

/* Light Theme Overrides (Experimental) */
.light {
  --bg-primary: #ffffff;
  --bg-secondary: #f3f3f3;
  --bg-tertiary: #e9e9e9;
  --border-color: #dcdcdc;
  --text-primary: #1a1a1a;
  --text-secondary: #4a4a4a;
}

.light body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.light .bg-\[\#18181A\], .light .bg-\[\#1E1E1E\], .light .bg-\[\#181818\] { background-color: var(--bg-primary) !important; }
.light .bg-\[\#252526\], .light .bg-\[\#2D2D2D\], .light .bg-\[\#242424\] { background-color: var(--bg-secondary) !important; }
.light .border-neutral-800, .light .border-\[\#1E1E1E\], .light .border-neutral-700 { border-color: var(--border-color) !important; }
.light .text-neutral-300, .light .text-neutral-400 { color: var(--text-secondary) !important; }
.light .text-white { color: #000 !important; }
.light .hover\:bg-neutral-800:hover { background-color: var(--bg-tertiary) !important; }
.light .bg-\[\#37373D\] { background-color: #007acc !important; color: white !important; }
</style>

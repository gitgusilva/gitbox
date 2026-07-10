<script setup lang="ts">
import { onMounted } from 'vue';
import { loadRepoData, startPolling } from './services/gitService';
import { loadAppVersion, initUpdater, checkForUpdates } from './services/versionService';
import { generalSettings } from './services/settingsService';
import { useTheme } from './services/themeService';
import AppLayout from './layouts/AppLayout.vue';
import DashboardView from './layouts/DashboardView.vue';

import { addLog } from './services/logService';

const { currentTheme, applyTheme } = useTheme();

onMounted(() => {
  // Initialize theme
  applyTheme(currentTheme.value);
  loadAppVersion();

  // Native auto-updater: subscribe to download/install events, then (if the
  // user opted in) run a silent check on startup. On updatable builds the main
  // process auto-downloads and we toast "restart to install" when ready.
  initUpdater();
  if (generalSettings.value.checkForUpdates !== false) {
    setTimeout(() => { checkForUpdates(); }, 4000);
  }

  if (window.gitbox && window.gitbox.onGitLog) {
      window.gitbox.onGitLog((_repoPath, cmd, stdout, stderr, duration, exitCode) => {
          // Ignore background polling status/branches/etc to avoid flooding
          const isBackground = cmd.includes('git status') || cmd.includes('git branch') || cmd.includes('git tag') || cmd.includes('git stash list') || cmd.includes('git submodule status');
          
          if (!isBackground || exitCode !== 0) {
            addLog(cmd, 'Git', exitCode === 0 ? 'command' : 'error', {
                command: cmd,
                details: stderr || stdout,
                duration
            });
          }
      });
  }

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
.simplebar-scrollbar::before { background: rgba(255, 255, 255, 0.2) !important; opacity: 1 !important; }
.simplebar-scrollbar.simplebar-visible::before { opacity: 1 !important; }
.simplebar-track.simplebar-vertical { width: 10px !important; }

/* Theme Transitions - Optimized to not use '*' selector */
body.initial-load * {
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.1s ease;
}

/* Light Theme Overrides - Polished for high contrast and consistency */
.light {
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #ffffff;
  --border-color: #d0d7de;
  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --accent-color: #0969da;
}

.light body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

/* Override hardcoded dark backgrounds */
.light .bg-\[\#18181A\], 
.light .bg-\[\#1E1E1E\], 
.light .bg-\[\#181818\], 
.light .bg-\[\#111827\], 
.light .bg-\[\#0b1220\], 
.light .bg-\[\#05070d\],
.light .bg-\[\#1A1A1A\],
.light .bg-\[\#202020\] { 
  background-color: var(--bg-primary) !important; 
}

.light .bg-\[\#252526\], 
.light .bg-\[\#2D2D2D\], 
.light .bg-\[\#242424\], 
.light .bg-\[\#2D2E30\],
.light .bg-\[\#2A2B2E\],
.light .bg-\[\#333333\] { 
  background-color: var(--bg-secondary) !important; 
}

/* Borders */
.light .border-neutral-800, 
.light .border-\[\#1E1E1E\], 
.light .border-neutral-700,
.light .border-\[\#2D2D2D\],
.light .border-\[\#3E4044\],
.light .border-light-border { 
  border-color: var(--border-color) !important; 
}

/* Text Colors */
.light .text-neutral-200,
.light .text-neutral-300 { 
  color: var(--text-primary) !important; 
}

.light .text-neutral-400, 
.light .text-neutral-500,
.light .text-neutral-600 { 
  color: var(--text-secondary) !important; 
}

.light .text-white { 
  color: #000000 !important; 
}

/* Highlights and Selections */
.light .hover\:bg-neutral-800:hover,
.light .hover\:bg-\[\#2D2D2D\]:hover,
.light .hover\:bg-\[\#3D3E40\]:hover,
.light .hover\:bg-\[\#252525\]:hover { 
  background-color: var(--bg-tertiary) !important; 
}

.light .bg-\[\#37373D\] { 
  background-color: var(--accent-color) !important; 
  color: #ffffff !important; 
}

.light .bg-neutral-700 {
  background-color: var(--bg-secondary) !important;
  color: var(--text-secondary) !important;
}

/* Fix specific UI elements gap */
.light .bg-neutral-900 {
  background-color: var(--bg-secondary) !important;
}

.light .from-\[\#111827\], .light .to-\[\#05070d\] {
  background: var(--bg-primary) !important;
}
</style>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import {
  appVersion,
  checkForUpdates,
  updateStatus,
  latestVersion,
  downloadProgress,
  downloadedVersion,
  installUpdate,
  openReleasePage,
  openWhatsNew,
  loadingWhatsNew,
  showWhatsNewModal,
} from '../../../services/versionService';
import { isSettingsOpen } from '../../../services/modalService';

const { t } = useI18n();

/**
 * The notes open as their own dialog on top of Settings, so Settings has to get
 * out of the way. Closed only once the notes are actually up — while the fetch
 * is in flight the spinner belongs here, and if there is nothing to show
 * (openWhatsNew falls back to the release page) the user keeps their place.
 */
async function viewChangelog() {
  await openWhatsNew();
  if (showWhatsNewModal.value) isSettingsOpen.value = false;
}
</script>

<template>
  <section class="space-y-3">
    <label class="block text-xs font-bold text-content-muted uppercase">{{ t('settings.updates') }}</label>
    <div class="flex items-center justify-between gap-3">
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-xs text-content">
          {{ t('settings.current_version') }}
          <span class="font-mono text-content-strong">v{{ appVersion }}</span>
        </span>
        <span v-if="updateStatus === 'up-to-date'" class="text-[11px] text-green-500 flex items-center gap-1">
          <Icon icon="lucide:check-circle" class="w-3 h-3" /> {{ t('settings.up_to_date') }}
        </span>
        <span v-else-if="updateStatus === 'downloading'" class="text-[11px] text-accent flex items-center gap-1">
          <Icon icon="lucide:download" class="w-3 h-3" /> {{ t('settings.downloading_update', { version: latestVersion, percent: downloadProgress }) }}
        </span>
        <span v-else-if="updateStatus === 'downloaded'" class="text-[11px] text-green-500 flex items-center gap-1">
          <Icon icon="lucide:check-circle-2" class="w-3 h-3" /> {{ t('settings.update_ready', { version: downloadedVersion }) }}
        </span>
        <span v-else-if="updateStatus === 'available'" role="button" @click="openReleasePage"
              class="text-[11px] text-accent flex items-center gap-1 cursor-pointer hover:underline">
          <Icon icon="lucide:download" class="w-3 h-3" /> {{ t('settings.update_available', { version: latestVersion }) }}
        </span>
        <span v-else-if="updateStatus === 'error'" class="text-[11px] text-red-400 flex items-center gap-1">
          <Icon icon="lucide:alert-circle" class="w-3 h-3" /> {{ t('settings.update_check_failed') }}
        </span>

        <!-- Re-open the release notes for the running version at any time; the
             automatic popup only ever fires once per version. -->
        <button @click="viewChangelog()" :disabled="loadingWhatsNew"
                class="text-[11px] text-content-muted hover:text-accent flex items-center gap-1 transition-colors disabled:opacity-50 w-fit">
          <Icon :icon="loadingWhatsNew ? 'lucide:loader-2' : 'lucide:scroll-text'"
                :class="loadingWhatsNew ? 'animate-spin' : ''" class="w-3 h-3" />
          {{ t('settings.view_changelog') }}
        </button>
      </div>

      <button v-if="updateStatus === 'downloaded'" @click="installUpdate()"
              class="shrink-0 h-8 px-3 rounded bg-accent hover:bg-accent-hover text-accent-fg text-[11px] font-semibold flex items-center gap-1.5 transition-colors">
        <Icon icon="lucide:rotate-cw" class="w-3.5 h-3.5" />
        {{ t('settings.restart_install') }}
      </button>
      <button v-else @click="checkForUpdates()" :disabled="updateStatus === 'checking' || updateStatus === 'downloading'"
              class="shrink-0 h-8 px-3 rounded bg-accent hover:bg-accent-hover text-accent-fg text-[11px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50">
        <Icon :icon="updateStatus === 'checking' ? 'lucide:loader-2' : 'lucide:refresh-cw'"
              :class="updateStatus === 'checking' ? 'animate-spin' : ''" class="w-3.5 h-3.5" />
        {{ t('settings.check_updates') }}
      </button>
    </div>

    <!-- Download progress (themed: track = surface, fill = accent) -->
    <div v-if="updateStatus === 'downloading'" class="h-1.5 w-full rounded-full bg-surface overflow-hidden">
      <div class="h-full bg-accent rounded-full transition-all duration-200" :style="{ width: downloadProgress + '%' }"></div>
    </div>
  </section>
</template>

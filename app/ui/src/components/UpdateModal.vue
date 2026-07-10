<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import Modal from './Common/Modal.vue';
import Button from './Common/Button.vue';
import {
  appVersion,
  latestVersion,
  showUpdateModal,
  dismissUpdate,
  closeUpdateModal,
  openReleasePage,
} from '../services/versionService';

const { t } = useI18n();

function download() {
  openReleasePage();
  // Downloading is a manual, out-of-app step — treat opening the page as
  // acknowledging this version so we don't nag on the next launch.
  dismissUpdate();
}
</script>

<template>
  <Modal
    :modelValue="showUpdateModal"
    @update:modelValue="!$event && closeUpdateModal()"
    :title="t('settings.update_modal_title')"
    icon="lucide:sparkles"
    icon-color="text-accent"
    width="440px"
  >
    <div class="p-6 space-y-5">
      <!-- Version transition, themed via semantic tokens -->
      <div class="flex items-center justify-center gap-3 py-2">
        <div class="flex flex-col items-center gap-1">
          <span class="text-[10px] uppercase tracking-wider text-content-muted font-bold">{{ t('settings.current_version') }}</span>
          <span class="font-mono text-sm text-content-muted">v{{ appVersion }}</span>
        </div>
        <Icon icon="lucide:arrow-right" class="text-content-muted w-4 h-4 shrink-0" />
        <div class="flex flex-col items-center gap-1">
          <span class="text-[10px] uppercase tracking-wider text-accent font-bold">{{ t('settings.updates') }}</span>
          <span class="font-mono text-sm font-semibold text-content-strong">v{{ latestVersion }}</span>
        </div>
      </div>

      <p class="text-xs text-content-muted leading-relaxed text-center">
        {{ t('settings.update_modal_body') }}
      </p>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <button
          @click="openReleasePage"
          class="text-[11px] text-content-muted hover:text-content inline-flex items-center gap-1.5 transition-colors"
        >
          <Icon icon="lucide:github" class="w-3.5 h-3.5" />
          {{ t('common.open_repo') }}
        </button>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="md" @click="dismissUpdate">
            {{ t('settings.update_later') }}
          </Button>
          <Button variant="primary" size="md" icon="lucide:download" @click="download">
            {{ t('settings.update_download') }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

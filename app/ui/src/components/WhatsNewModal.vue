<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Modal from './Common/Modal.vue';
import Button from './Common/Button.vue';
import {
  appVersion,
  whatsNewNotes,
  showWhatsNewModal,
  closeWhatsNew,
  openReleasePage,
} from '../services/versionService';

const { t } = useI18n();

// The notes are release-author markdown fetched over the network, so they are
// sanitized before being injected — same treatment as the AI explanation view.
const renderedNotes = computed(() => {
  try {
    return DOMPurify.sanitize(marked.parse(whatsNewNotes.value || '') as string);
  } catch {
    return whatsNewNotes.value;
  }
});
</script>

<template>
  <Modal
    :modelValue="showWhatsNewModal"
    @update:modelValue="!$event && closeWhatsNew()"
    :title="t('settings.whats_new_title', { version: appVersion })"
    icon="lucide:party-popper"
    icon-color="text-accent"
    width="560px"
    max-height="70vh"
    :scroll-body="true"
  >
    <div class="p-6">
      <div
        class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed break-words text-content"
        v-html="renderedNotes"
      ></div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <button
          @click="openReleasePage"
          class="text-[11px] text-content-muted hover:text-content inline-flex items-center gap-1.5 transition-colors"
        >
          <Icon icon="lucide:github" class="w-3.5 h-3.5" />
          {{ t('settings.whats_new_full_release') }}
        </button>
        <Button variant="primary" size="md" @click="closeWhatsNew">
          {{ t('view.close') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

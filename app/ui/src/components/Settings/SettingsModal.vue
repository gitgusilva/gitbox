<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { settingsActiveSection } from '../../services/modalService';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { generalSettings } from '../../services/settingsService';
import { refreshLogCap } from '../../services/gitService';
import { appVersion } from '../../services/versionService';

// UI Components
import Tabs from '../Common/Tabs.vue';
import Tab from '../Common/Tab.vue';

// Section Contents
import GeneralSection from './Sections/GeneralSection.vue';
import Modal from '../Common/Modal.vue';
import GitSection from './Sections/GitSection.vue';
import IntegrationsSection from './Sections/IntegrationsSection.vue';
import PreferencesSection from './Sections/PreferencesSection.vue';
import ScrollArea from '../Common/ScrollArea.vue';

const { t } = useI18n();
const emit = defineEmits(['close']);

const initialHistoryCount = ref(2000);

onMounted(() => {
    initialHistoryCount.value = generalSettings.value.historyCount;
});

function handleClose() {
    if (generalSettings.value.historyCount !== initialHistoryCount.value) {
        // Apply the new cap in place — don't reload the whole repo (which reset
        // the list to the first page and jumped the scroll back to the top).
        refreshLogCap();
        initialHistoryCount.value = generalSettings.value.historyCount;
    }
    // Always reopen on the General tab next time; other openers (e.g. "Connect
    // integration") set their own section right before opening.
    settingsActiveSection.value = 'general';
    emit('close');
}
</script>

<template>
  <Modal :modelValue="true" @update:modelValue="!$event && handleClose()" width="750px" height="580px" :scroll-body="false">
    <template #header><div class="hidden" /></template>
    
    <Tabs v-model="settingsActiveSection" vertical class="w-full h-full">
      <!-- Sidebar Header -->
      <template #sidebar-header>
        <div class="px-5 py-6">
          <h2 class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest opacity-80">{{ t('settings.title') }}</h2>
        </div>
      </template>

      <!-- Main Content Container with dynamic title and scroll area -->
      <template #default="{ activeTabLabel }">
        <div class="flex flex-col h-full bg-white dark:bg-[#1e1e1e]">
            <header class="h-14 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-8 bg-neutral-100 dark:bg-[#252526] flex-shrink-0">
                <h1 class="font-bold text-sm text-neutral-800 dark:text-neutral-200 uppercase tracking-tight">{{ activeTabLabel }}</h1>
                <button @click="handleClose()" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors p-2 bg-white/0 hover:bg-white/5 rounded-full">
                    <Icon icon="lucide:x" class="text-lg" />
                </button>
            </header>
            <ScrollArea class="flex-1" style="min-height: 0;">
                <div class="p-8 pb-12 max-w-2xl mx-auto">
                    <Tab id="general" :label="t('settings.general')" icon="lucide:settings">
                        <GeneralSection @close="handleClose()" />
                    </Tab>
                    
                    <Tab id="preferences" :label="t('settings.preferences')" icon="lucide:sliders">
                        <PreferencesSection />
                    </Tab>
                    
                    <Tab id="git" :label="t('settings.git')" icon="lucide:git-branch">
                        <GitSection />
                    </Tab>
                    
                    <Tab id="integrations" :label="t('settings.integrations')" icon="lucide:link">
                        <IntegrationsSection />
                    </Tab>
                </div>
            </ScrollArea>
        </div>
      </template>

      <!-- Sidebar Footer -->
      <template #sidebar-footer>
          <div class="p-4 border-t border-neutral-200 dark:border-neutral-800/20 bg-black/5">
              <div class="text-[9px] text-neutral-600 font-mono tracking-tighter opacity-70">GITBOX v{{ appVersion }}</div>
          </div>
      </template>
    </Tabs>
  </Modal>
</template>

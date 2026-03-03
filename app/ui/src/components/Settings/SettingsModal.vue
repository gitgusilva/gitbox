<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { settingsActiveSection } from '../../services/modalService';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { generalSettings } from '../../services/settingsService';
import { loadRepoData } from '../../services/gitService';

// UI Components
import Tabs from '../Common/Tabs.vue';
import Tab from '../Common/Tab.vue';

// Section Contents
import GeneralSection from './Sections/GeneralSection.vue';
import Modal from '../Common/Modal.vue';
import GitSection from './Sections/GitSection.vue';
import IntegrationsSection from './Sections/IntegrationsSection.vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

const { t } = useI18n();
const emit = defineEmits(['close']);

const activeSection = settingsActiveSection;
const initialHistoryCount = ref(2000);

onMounted(() => {
    initialHistoryCount.value = generalSettings.value.historyCount;
});

function handleClose() {
    if (generalSettings.value.historyCount !== initialHistoryCount.value) {
        loadRepoData(true);
    }

    emit('close');
}
</script>

<template>
  <Modal :modelValue="true" @update:modelValue="!$event && handleClose()" width="700px" height="550px">
    <template #header><div class="hidden" /></template>
    <div class="flex-1 flex overflow-hidden">
        <Tabs v-model="activeSection" vertical class="w-full h-full">
          <!-- Custom Sidebar Header -->
          <template #sidebar-header>
            <h2 class="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">{{ t('settings.title') }}</h2>
          </template>
 
          <!-- Main Layout using Scoped Slot for dynamic title -->
          <template #default="{ activeTabLabel }">
            <div class="flex flex-col h-full bg-[#1e1e1e]">
              <header class="h-12 border-b border-neutral-800 flex items-center justify-between px-6 bg-[#252526] flex-shrink-0">
                <h1 class="font-bold text-sm text-neutral-200">
                  {{ activeTabLabel }}
                </h1>
                <button @click="handleClose()" class="text-neutral-500 hover:text-white transition-colors">
                  <Icon icon="lucide:x" class="text-lg" />
                </button>
              </header>
 
              <SimpleBar class="flex-1" style="min-height: 0;">
                <div class="p-8">
                  <Tab id="general" :label="t('settings.general')" icon="lucide:settings">
                    <GeneralSection @close="handleClose()" />
                  </Tab>
                  
                  <Tab id="git" :label="t('settings.git')" icon="lucide:git-branch">
                    <GitSection />
                  </Tab>
                  
                  <Tab id="integrations" :label="t('settings.integrations')" icon="lucide:link">
                    <IntegrationsSection />
                  </Tab>
                </div>
              </SimpleBar>
            </div>
          </template>

          <!-- Custom Sidebar Footer if needed -->
          <template #sidebar-footer>
              <div class="mt-auto p-4 border-t border-neutral-800/50">
                  <div class="text-[9px] text-neutral-600 font-mono">GITBOX v1.0.0</div>
              </div>
          </template>
        </Tabs>
    </div>
  </Modal>
</template>



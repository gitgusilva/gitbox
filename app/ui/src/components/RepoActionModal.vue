<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import ScrollArea from './Common/ScrollArea.vue';

const { t } = useI18n();

const props = defineProps<{ action: 'init' | 'clone' }>();
const emit = defineEmits(['close', 'success']);

const activeTab = ref(props.action === 'init' ? 'local' : 'url');

// Clone Form
const cloneUrl = ref('');
const cloneTargetDir = ref('');

// Init Form
const initName = ref('');
const initTargetDir = ref('');
const defaultBranch = ref('main');

async function handleAction() {
    alert(t('modal.repo_action_coming_soon'));
    emit('close');
}

async function browseFolder(formType: 'clone' | 'init') {
    if (!window.gitbox) return;
    const path = await window.gitbox.selectFolder();
    if (path) {
        if (formType === 'clone') cloneTargetDir.value = path;
        else initTargetDir.value = path;
    }
}
</script>

<template>
  <Modal :modelValue="true" @update:modelValue="!$event && emit('close')" width="850px" height="550px">
     <template #header><div class="hidden"></div></template>
     <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <aside class="w-64 bg-surface border-r border-line-strong py-3 flex flex-col">
        <div class="text-[15px] font-bold text-content px-4 mb-4 mt-2">{{ props.action === 'init' ? t('modal.initialize_a_repository') : t('modal.clone_a_repository') }}</div>
        
        <button v-if="props.action === 'init'"
                @click="activeTab = 'local'" 
                class="flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors text-left"
                :class="activeTab === 'local' ? 'bg-surface-hover text-content-strong border-l-2 border-[#4182E1]' : 'text-content-muted hover:bg-neutral-200 dark:hover:bg-[#2A2B2E] hover:text-neutral-900 dark:hover:text-white border-l-2 border-transparent'">
          <Icon icon="lucide:monitor" class="w-4 h-4 ml-1" /> {{ t('modal.local_only') }}
        </button>

        <button v-if="props.action === 'clone'"
                @click="activeTab = 'url'" 
                class="flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors text-left"
                :class="activeTab === 'url' ? 'bg-surface-hover text-content-strong border-l-2 border-[#4182E1]' : 'text-content-muted hover:bg-neutral-200 dark:hover:bg-[#2A2B2E] hover:text-neutral-900 dark:hover:text-white border-l-2 border-transparent'">
          <Icon icon="lucide:globe" class="w-4 h-4 ml-1" /> {{ t('modal.clone_with_url') }}
        </button>
      </aside>

      <!-- Main Config -->
      <main class="flex-1 flex flex-col min-w-0 bg-surface">
        <header class="h-12 flex items-center justify-between px-6 pt-2">
          <h1 class="text-[17px] text-content">
             {{ props.action === 'init' ? t('modal.initialize_a_repo') : t('modal.clone_a_repo') }}
          </h1>
          <button @click="emit('close')" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
            <Icon icon="lucide:x" class="w-5 h-5" />
          </button>
        </header>

        <ScrollArea class="flex-1 p-6">
          
          <!-- Local Init -->
          <div v-if="activeTab === 'local'" class="flex flex-col gap-6 max-w-[500px]">
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.name') }}</label>
                <input v-model="initName" type="text" class="flex-1 bg-app border border-line-strong rounded-sm px-3 py-1.5 text-[13px] text-content-strong outline-none focus:border-accent" />
             </div>
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.initialize_in') }}</label>
                <div class="flex-1 flex gap-2">
                    <input v-model="initTargetDir" type="text" class="flex-1 bg-app border border-line-strong rounded-sm px-3 py-1.5 text-[13px] text-content-strong outline-none focus:border-accent" />
                    <button @click="browseFolder('init')" class="bg-[#3A6B9B] hover:bg-[#467FB7] text-white px-4 rounded-sm text-[13px] font-medium transition-colors">{{ t('modal.browse') }}</button>
                </div>
             </div>
             
             <div class="flex justify-between gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.full_path') }}</label>
                <div class="flex-1 text-[13px] text-content-strong font-mono opacity-80 break-all select-all">
                    {{ initTargetDir || '/' }}{{ initTargetDir && !initTargetDir.endsWith('/') && !initTargetDir.endsWith('\\') ? '/' : '' }}{{ initName }}
                </div>
             </div>

             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.default_branch_name') }}</label>
                <input v-model="defaultBranch" type="text" class="flex-1 bg-app border border-line-strong rounded-sm px-3 py-1.5 text-[13px] text-content-strong outline-none focus:border-accent" />
             </div>
             
             <div class="flex justify-end mt-4">
                <button @click="handleAction" class="bg-[#236041] hover:bg-[#348A5E] text-green-100 border border-[#2B7951] px-5 py-2 rounded-sm text-[13px] shadow transition-colors font-semibold">{{ t('modal.create_repository') }}</button>
             </div>
          </div>

          <!-- URL Clone -->
          <div v-if="activeTab === 'url'" class="flex flex-col gap-6 max-w-[500px]">
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.where_to_clone_to') }}</label>
                <div class="flex-1 flex gap-2">
                    <input v-model="cloneTargetDir" type="text" class="flex-1 bg-app border border-line-strong rounded-sm px-3 py-1.5 text-[13px] text-content-strong outline-none focus:border-accent" />
                    <button @click="browseFolder('clone')" class="bg-[#3A6B9B] hover:bg-[#467FB7] text-white px-4 rounded-sm text-[13px] font-medium transition-colors">{{ t('modal.browse') }}</button>
                </div>
             </div>
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.url') }}</label>
                <input v-model="cloneUrl" type="text" class="flex-1 bg-app border border-line-strong rounded-sm px-3 py-1.5 text-[13px] text-content-strong outline-none focus:border-accent" />
             </div>

             <div class="flex justify-between gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.full_path') }}</label>
                <div class="flex-1 text-[13px] text-content-strong font-mono opacity-80 break-all select-all">
                    {{ cloneTargetDir || '/' }}
                </div>
             </div>
             
             <div class="flex justify-end mt-4">
                <button @click="handleAction" class="bg-[#236041] hover:bg-[#348A5E] text-green-100 border border-[#2B7951] px-5 py-2 rounded-sm text-[13px] shadow transition-colors font-semibold">{{ t('modal.clone_the_repo') }}</button>
             </div>
          </div>

        </ScrollArea>
      </main>
    </div>
  </Modal>
</template>



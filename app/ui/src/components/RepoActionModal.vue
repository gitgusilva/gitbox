<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import ScrollArea from './Common/ScrollArea.vue';
import Button from './Common/Button.vue';
import { openRepository } from '../services/workspaceService';

const { t } = useI18n();

const busy = ref(false);

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
    if (props.action === 'clone') {
        if (!window.gitbox || !cloneUrl.value.trim() || !cloneTargetDir.value.trim() || busy.value) return;
        busy.value = true;
        try {
            const res = await window.gitbox.clone(cloneUrl.value.trim(), cloneTargetDir.value.trim());
            if (res && res.path) openRepository(res.path, res.name);
            emit('success');
            emit('close');
        } catch (e: any) {
            alert(e?.message || 'Clone failed');
        } finally {
            busy.value = false;
        }
        return;
    }

    // init
    if (!window.gitbox || !initTargetDir.value.trim() || busy.value) return;
    busy.value = true;
    try {
        const res = await window.gitbox.init(initTargetDir.value.trim(), initName.value.trim(), defaultBranch.value.trim() || 'main');
        if (res && res.path) openRepository(res.path, res.name);
        emit('success');
        emit('close');
    } catch (e: any) {
        alert(e?.message || 'Init failed');
    } finally {
        busy.value = false;
    }
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
                :class="activeTab === 'local' ? 'bg-surface-hover text-content-strong border-l-2 border-accent' : 'text-content-muted hover:bg-surface-hover hover:text-content-strong border-l-2 border-transparent'">
          <Icon icon="lucide:monitor" class="w-4 h-4 ml-1" /> {{ t('modal.local_only') }}
        </button>

        <button v-if="props.action === 'clone'"
                @click="activeTab = 'url'" 
                class="flex items-center gap-2 px-4 py-2.5 text-[13px] transition-colors text-left"
                :class="activeTab === 'url' ? 'bg-surface-hover text-content-strong border-l-2 border-accent' : 'text-content-muted hover:bg-surface-hover hover:text-content-strong border-l-2 border-transparent'">
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
                    <Button variant="secondary" @click="browseFolder('init')">{{ t('modal.browse') }}</Button>
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
                <Button variant="primary" :loading="busy" icon="lucide:folder-plus" @click="handleAction">{{ t('modal.create_repository') }}</Button>
             </div>
          </div>

          <!-- URL Clone -->
          <div v-if="activeTab === 'url'" class="flex flex-col gap-6 max-w-[500px]">
             
             <div class="flex justify-between items-center gap-4">
                <label class="text-[13px] text-content-muted w-32 text-right shrink-0">{{ t('modal.where_to_clone_to') }}</label>
                <div class="flex-1 flex gap-2">
                    <input v-model="cloneTargetDir" type="text" class="flex-1 bg-app border border-line-strong rounded-sm px-3 py-1.5 text-[13px] text-content-strong outline-none focus:border-accent" />
                    <Button variant="secondary" @click="browseFolder('clone')">{{ t('modal.browse') }}</Button>
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
                <Button variant="primary" :loading="busy" icon="lucide:git-branch" @click="handleAction">{{ t('modal.clone_the_repo') }}</Button>
             </div>
          </div>

        </ScrollArea>
      </main>
    </div>
  </Modal>
</template>



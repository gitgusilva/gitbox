<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import Checkbox from './Common/Checkbox.vue';
import Select from './Common/Select.vue';
import { isPushModalOpen, requestConfirm } from '../services/modalService';
import { branches, remotes, confirmPush, repoPath } from '../services/gitService';
import { Icon } from '@iconify/vue';


const { t } = useI18n();

const remoteList = computed(() => remotes.value.length > 0 ? remotes.value : ['origin']);
const selectedRemote = ref(remoteList.value[0]);

const currentBranch = computed(() => branches.value.find(b => b.is_head)?.name || '');
const targetBranch = ref('');
const isTargetNew = computed(() => {
    return !branches.value.find(b => b.is_remote && b.name === `${selectedRemote.value}/${targetBranch.value}`);
});

const setUpstream = ref(true);
const pushTags = ref(false);
const forcePush = ref(false);

watch(repoPath, () => {
    targetBranch.value = '';
    selectedRemote.value = remoteList.value[0];
});

const remoteOptions = computed(() => {
    return remoteList.value.map(r => ({ value: r, label: r, icon: 'mdi:cloud-outline' }));
});

const remoteBranchesOptions = computed(() => {
    const arr = branches.value
        .filter(b => b.is_remote && b.name.startsWith(`${selectedRemote.value}/`))
        .map(b => b.name.replace(`${selectedRemote.value}/`, ''));
    
    return arr.map(r => ({ value: r, label: r, icon: 'mdi:source-branch' }));
});

// Remove old filtered logic since Select handles it

// Removed dropdown functions

watch(() => isPushModalOpen.value, (isOpen) => {
    if (isOpen) {
        targetBranch.value = currentBranch.value;
        selectedRemote.value = remoteList.value[0];
        setUpstream.value = true;
        pushTags.value = false;
        forcePush.value = false;
    }
});

function onConfirm() {
    const doPush = () => confirmPush(selectedRemote.value, targetBranch.value, setUpstream.value, forcePush.value, pushTags.value);
    // Force push can rewrite remote history — make the user confirm explicitly.
    if (forcePush.value) {
        requestConfirm(
            t('push_modal.force_push_confirm_title'),
            t('push_modal.force_push_confirm_msg', { remote: selectedRemote.value, branch: targetBranch.value }),
            true,
            doPush
        );
    } else {
        doPush();
    }
}
</script>

<template>
  <Modal v-model="isPushModalOpen" :title="t('push_modal.title') || 'Push Changes To Remote'" width="600px">
      <template #default>
         <main class="p-6">
            <div class="flex flex-row gap-8">
                <!-- Left Column: Checkboxes / Options -->
                <div class="w-[40%] space-y-4 pt-1">
                    <div class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2">{{ t('push_modal.options') || 'Options' }}</div>
                    <Checkbox v-model="setUpstream" :label="t('push_modal.set_upstream') || 'Set as tracking branch'" />
                    <Checkbox v-model="pushTags" :label="t('push_modal.push_tags') || 'Push all tags'" />
                    <Checkbox v-model="forcePush" :label="t('push_modal.force_push') || 'Force push'" />
                    <p v-if="forcePush" class="flex items-start gap-1.5 text-[10px] leading-snug text-red-500/90">
                        <Icon icon="lucide:alert-triangle" class="text-xs shrink-0 mt-px" />
                        <span>{{ t('push_modal.force_push_warning') }}</span>
                    </p>
                </div>

                <!-- Right Column: Selects -->
                <div class="w-[60%] space-y-5 border-l border-neutral-200 dark:border-neutral-800 pl-8">
                    <div class="space-y-1.5 flex flex-col">
                        <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('push_modal.local_branch') || 'Local Branch' }}</label>
                        <div class="bg-neutral-100 dark:bg-[#2a2a2d] border border-neutral-300 dark:border-neutral-700/50 rounded-lg px-3 py-2 flex items-center gap-2 opacity-70 cursor-not-allowed">
                            <Icon icon="mdi:source-branch" class="text-neutral-600 dark:text-neutral-400" />
                            <span class="text-neutral-900 dark:text-white text-xs truncate">{{ currentBranch }}</span>
                        </div>
                    </div>

                    <div class="space-y-1.5 flex flex-col">
                        <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('push_modal.remote') || 'Remote' }}</label>
                        <Select v-model="selectedRemote" :options="remoteOptions" icon="mdi:cloud-outline" />
                    </div>

                    <div class="space-y-1.5 flex flex-col">
                        <label class="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center justify-between">
                            {{ t('push_modal.remote_branch') || 'Remote Branch' }}
                            <span v-if="isTargetNew" class="bg-green-600/20 text-green-500 text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border border-green-500/30">
                                {{ t('push_modal.new') || 'NEW' }}
                            </span>
                        </label>
                        <Select v-model="targetBranch" :options="remoteBranchesOptions" creatable :placeholder="t('modal.search_or_create_branch')" icon="mdi:source-branch" />
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button @click="isPushModalOpen = false" class="px-5 py-1.5 rounded bg-transparent text-neutral-700 dark:text-neutral-300 text-xs font-bold hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                    {{ t('common.cancel') || 'Cancel' }}
                </button>
                <button @click="onConfirm" :disabled="!targetBranch" class="px-6 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {{ t('common.push') || 'Push' }}
                </button>
            </div>
         </main>
      </template>
  </Modal>
</template>

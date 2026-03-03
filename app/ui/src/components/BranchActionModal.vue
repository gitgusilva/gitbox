<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { branchActionModal } from '../services/modalService';
import { generalSettings } from '../services/settingsService';
import Modal from './Common/Modal.vue';

const { t } = useI18n();
const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const confirmDisabled = computed(() => {
    if (branchActionModal.value?.type === 'create_branch' && !inputValue.value.trim()) return true;
    return false;
});

const highlightedBranchName = computed(() => {
    const val = inputValue.value || '';
    const match = val.match(/^((?:bugfix|feature|hotfix|pr|release|fix|chore|docs|refactor|test|wip|build|ci|perf|style)\/)(.*)/i);
    if (match) {
        let prefixClass = 'text-blue-400 bg-blue-900/30'; // default feature-like
        const prefixLower = match[1].toLowerCase();
        
        if (prefixLower.startsWith('bug') || prefixLower.startsWith('hot') || prefixLower.startsWith('fix')) 
           prefixClass = 'text-red-400 bg-red-900/30';
        else if (prefixLower.startsWith('feat')) 
           prefixClass = 'text-green-400 bg-green-900/30';
        else if (prefixLower.startsWith('pr')) 
           prefixClass = 'text-purple-400 bg-purple-900/30';
        else if (prefixLower.startsWith('rel')) 
           prefixClass = 'text-orange-400 bg-orange-900/30';

        return `<span class="${prefixClass} rounded font-semibold px-0.5">${match[1]}</span><span>${match[2]}</span>`;
    }
    return `<span>${val}</span>`;
});

watch(() => branchActionModal.value, (newVal) => {
    if (newVal?.type === 'create_branch') {
        inputValue.value = newVal.targetBranch || '';
        nextTick(() => {
            if (inputRef.value) inputRef.value.focus();
        });
    }
}, { immediate: true });

function handleAction(action: 'stash' | 'discard' | 'keep') {
    if (branchActionModal.value) {
        branchActionModal.value.onConfirm(action, inputValue.value.trim());
        branchActionModal.value = null;
    }
}

function handleCancel() {
    branchActionModal.value = null;
}
</script>

<template>
  <Modal v-if="branchActionModal" :modelValue="true" @update:modelValue="!$event && handleCancel()" :title="branchActionModal.type === 'create_branch' ? 'Create New Branch' : 'Checkout Conflicts'" width="512px">
        
        <div class="p-6 pb-2">
          <div class="flex flex-col gap-4 mb-6">

          <div v-if="branchActionModal.type === 'create_branch'" class="space-y-2">
            <span class="text-xs text-neutral-400">Branch Name:</span>
            <div class="relative w-full">
                <!-- Highlight Overlay -->
                <template v-if="generalSettings.highlightBranchPrefixes">
                    <div class="absolute inset-0 pointer-events-none px-3 py-2 text-xs font-mono flex items-center whitespace-pre overflow-hidden" aria-hidden="true" v-if="inputValue">
                       <div v-html="highlightedBranchName" class="translate-y-[1px]"></div>
                    </div>
                    <div class="absolute inset-0 pointer-events-none px-3 py-2 text-xs font-mono flex items-center whitespace-pre overflow-hidden text-neutral-600" aria-hidden="true" v-else>
                       e.g. feature/new-component
                    </div>
                    <!-- Actual Input -->
                    <input ref="inputRef" v-model="inputValue" type="text" spellcheck="false" class="w-full relative z-10 bg-transparent border border-neutral-700/50 rounded px-3 py-2 text-xs text-transparent caret-white focus:border-blue-500 outline-none font-mono placeholder-transparent" placeholder="e.g. feature/new-component" @keydown.enter="handleAction('keep')" />
                </template>
                <template v-else>
                    <input ref="inputRef" v-model="inputValue" type="text" spellcheck="false" class="w-full relative z-10 bg-[#252526] border border-neutral-700/50 rounded px-3 py-2 text-xs text-white focus:border-blue-500 outline-none placeholder-neutral-500" placeholder="e.g. feature/new-component" @keydown.enter="handleAction('keep')" />
                </template>
            </div>
          </div>

          <div v-else-if="branchActionModal.type === 'checkout_conflict'" class="text-xs text-neutral-400">
            You have uncommitted changes that conflict with the destination branch <b class="text-blue-400">{{ branchActionModal.targetBranch }}</b>.
          </div>
          
          <div v-if="branchActionModal.hasChanges" class="text-xs text-yellow-500 bg-yellow-500/10 p-3 rounded border-l-2 border-yellow-500 mt-2">
             You have local changes. How would you like to handle them before proceeding?
          </div>
        </div>
        
        <div class="flex justify-end gap-3 flex-wrap">
          <button @click="handleCancel" class="px-5 py-2 rounded border border-neutral-700 text-xs font-bold bg-[#252526] hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all outline-none uppercase tracking-widest">{{ t('common.cancel') }}</button>
          
          <template v-if="branchActionModal.hasChanges">
             <button @click="handleAction('discard')" :disabled="confirmDisabled" class="px-4 py-2 rounded text-xs font-bold text-white transition-all outline-none disabled:opacity-30 uppercase tracking-widest bg-red-600 hover:bg-red-500">Discard & Proceed</button>
             <button @click="handleAction('stash')" :disabled="confirmDisabled" class="px-4 py-2 rounded text-xs font-bold text-white transition-all outline-none disabled:opacity-30 uppercase tracking-widest bg-orange-600 hover:bg-orange-500">Stash & Proceed</button>
          </template>

          <button @click="handleAction('keep')" :disabled="confirmDisabled" class="px-4 py-2 rounded text-xs font-bold text-white transition-all outline-none disabled:opacity-30 uppercase tracking-widest bg-blue-600 hover:bg-blue-500">
              {{ branchActionModal.hasChanges ? 'Keep & Proceed' : 'Proceed' }}
          </button>
        </div>
        </div>
  </Modal>
</template>



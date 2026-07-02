<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { deviceFlowModal } from '../services/modalService';
import Modal from './Common/Modal.vue';

const { t } = useI18n();

const codeChars = computed(() => {
    if (!deviceFlowModal.value) return [];
    return deviceFlowModal.value.userCode.split('');
});

function copyCode() {
    if (deviceFlowModal.value) {
        navigator.clipboard.writeText(deviceFlowModal.value.userCode);
        alert(t('github_auth.copied'));
    }
}

function openBrowser() {
    if (deviceFlowModal.value && window.gitbox?.openExternal) {
        window.gitbox.openExternal(deviceFlowModal.value.verificationUri);
    }
}
</script>

<template>
  <Modal :modelValue="true" @update:modelValue="!$event && deviceFlowModal?.onCancel()" :title="t('github_auth.title')" icon="mdi:github" iconColor="text-black dark:text-white" width="500px">
        <div class="p-8 flex flex-col items-center text-center">
            <div class="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center text-3xl mb-4">
                <Icon icon="lucide:smartphone" />
            </div>

            <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-6 font-medium leading-relaxed">
                {{ t('github_auth.instruction') }}
            </p>

            <div class="flex justify-center flex-nowrap gap-1.5 my-2 relative group w-full" @click="copyCode" :title="t('github_auth.copy_code_tooltip')">
                <template v-for="(char, idx) in codeChars" :key="idx">
                    <div v-if="char === '-'" class="w-4 h-11 flex items-center justify-center text-neutral-500">—</div>
                    <div v-else class="w-9 h-11 flex items-center justify-center bg-neutral-100 dark:bg-[#2a2a2d] border border-neutral-300/50 dark:border-neutral-700/50 rounded-lg text-lg font-mono font-bold text-neutral-900 dark:text-white shadow-inner">
                        {{ char }}
                    </div>
                </template>
                
                <div class="absolute inset-0 bg-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer flex items-center justify-center backdrop-blur-[2px]">
                    <Icon icon="lucide:copy" class="text-white text-xl drop-shadow-md" />
                </div>
            </div>

            <p class="text-[10px] text-neutral-500 mt-2 mb-8 uppercase tracking-widest font-bold">
                {{ t('github_auth.click_to_copy') }}
            </p>

            <button @click="openBrowser" class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2">
                <Icon icon="lucide:external-link" class="text-white/70" /> {{ t('github_auth.open_browser') }}
            </button>
            <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-5 flex items-center gap-2 justify-center bg-black/20 py-2 px-4 rounded-full border border-neutral-200 dark:border-neutral-800">
                <Icon icon="lucide:loader-2" class="animate-spin text-blue-400" /> {{ t('github_auth.waiting') }}
            </p>
        </div>
  </Modal>
</template>

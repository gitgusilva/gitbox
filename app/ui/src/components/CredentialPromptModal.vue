<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import Modal from './Common/Modal.vue';
import Button from './Common/Button.vue';
import Checkbox from './Common/Checkbox.vue';
import { credentialPrompt } from '../services/modalService';

const { t } = useI18n();

const username = ref('');
const password = ref('');
const remember = ref(false);
const userInput = ref<HTMLInputElement | null>(null);

const open = computed(() => !!credentialPrompt.value);
const host = computed(() => credentialPrompt.value?.host || '');
const rejected = computed(() => !!credentialPrompt.value?.rejected);
const canSubmit = computed(() => !!password.value);

// Reset + focus each time a fresh prompt opens. `remember` defaults OFF — the
// askpass default is to keep credentials for the session only.
watch(open, async (isOpen) => {
    if (isOpen) {
        username.value = '';
        password.value = '';
        remember.value = false;
        await nextTick();
        userInput.value?.focus();
    }
});

function submit() {
    if (!canSubmit.value) return;
    credentialPrompt.value?.resolve({ username: username.value.trim(), password: password.value, remember: remember.value });
}

function cancel() {
    credentialPrompt.value?.resolve(null);
}
</script>

<template>
  <Modal v-if="open" :modelValue="true" :closeOnOverlay="false" @update:modelValue="!$event && cancel()" width="440px" height="auto">
     <template #header><div class="hidden"></div></template>
     <div class="p-6 flex flex-col gap-5">
        <div class="flex items-start gap-3">
           <div class="w-10 h-10 rounded-lg flex items-center justify-center border border-line bg-surface-hover shrink-0">
              <Icon icon="lucide:lock-keyhole" class="w-5 h-5 text-accent" />
           </div>
           <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                 <h1 class="text-[15px] font-bold text-content-strong">{{ t('credential_prompt.title') }}</h1>
                 <span class="text-[9px] font-mono font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">askpass</span>
              </div>
              <p class="text-[12px] text-content-muted leading-relaxed mt-1">
                 {{ rejected ? t('credential_prompt.rejected', { host }) : t('credential_prompt.needed', { host }) }}
              </p>
           </div>
           <button @click="cancel" :title="t('common.cancel')"
                   class="w-7 h-7 -mr-1 -mt-1 shrink-0 center rounded-lg text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white transition-all">
              <Icon icon="lucide:x" class="w-4 h-4" />
           </button>
        </div>

        <div class="flex flex-col gap-3">
           <div>
              <label class="block text-[10px] font-bold text-content-muted uppercase mb-1.5">{{ t('modal.username') }}</label>
              <input ref="userInput" v-model="username" type="text" autocomplete="off" @keyup.enter="submit"
                     :placeholder="t('modal.username_placeholder')"
                     class="w-full bg-app border border-line rounded px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
           </div>
           <div>
              <label class="block text-[10px] font-bold text-content-muted uppercase mb-1.5">{{ t('modal.password') }}</label>
              <input v-model="password" type="password" autocomplete="off" @keyup.enter="submit"
                     :placeholder="t('modal.password_placeholder')"
                     class="w-full bg-app border border-line rounded px-3 py-2 text-[13px] text-content-strong outline-none focus:border-accent transition-colors" />
           </div>
           <Checkbox v-model="remember" class="items-start pt-0.5">
              <span class="text-[11px] text-content leading-snug">
                 {{ t('credential_prompt.remember') }}
                 <span class="block text-[10px] text-content-muted mt-0.5">
                    {{ t('credential_prompt.remember_on') }}
                 </span>
              </span>
           </Checkbox>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
           <Button variant="secondary" @click="cancel">{{ t('common.cancel') }}</Button>
           <Button variant="primary" :disabled="!canSubmit" icon="lucide:log-in" @click="submit">{{ t('credential_prompt.connect') }}</Button>
        </div>
     </div>
  </Modal>
</template>

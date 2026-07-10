<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { branchActionModal } from '../services/modalService';
import { generalSettings } from '../services/settingsService';
import Modal from './Common/Modal.vue';

const { t } = useI18n();
const inputValue = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
// How to handle local changes on a conflicting checkout (mirrors the radios).
const localChangeChoice = ref<'stash' | 'discard'>('stash');

const confirmDisabled = computed(() => {
    if (branchActionModal.value?.type === 'create_branch' && !inputValue.value.trim()) return true;
    return false;
});

/** Escape user text before it goes into v-html (branch names are free-form). */
function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const highlightedBranchName = computed(() => {
    const val = inputValue.value || '';
    const match = val.match(/^((?:bugfix|feature|hotfix|pr|release|fix|chore|docs|refactor|test|wip|build|ci|perf|style)\/)(.*)/i);
    if (match) {
        // Map each prefix category to a semantic THEME token so the badge adapts to
        // the active theme (light/dark/custom), like the history commit badges —
        // instead of fixed tailwind colours that ignore the theme.
        const prefixLower = match[1].toLowerCase();
        let cssVar = '--gb-accent'; // default (feature-like)
        if (prefixLower.startsWith('bug') || prefixLower.startsWith('hot') || prefixLower.startsWith('fix'))
           cssVar = '--gb-removed';
        else if (prefixLower.startsWith('feat'))
           cssVar = '--gb-added';
        else if (prefixLower.startsWith('rel'))
           cssVar = '--gb-modified';

        const style = `color: rgb(var(${cssVar})); background: rgb(var(${cssVar}) / 0.18);`;
        return `<span style="${style}" class="rounded font-semibold px-0.5">${escapeHtml(match[1])}</span><span>${escapeHtml(match[2])}</span>`;
    }
    return `<span>${escapeHtml(val)}</span>`;
});

watch(() => branchActionModal.value, (newVal) => {
    if (newVal?.type === 'create_branch') {
        inputValue.value = newVal.targetBranch || '';
        nextTick(() => {
            if (inputRef.value) inputRef.value.focus();
        });
    } else if (newVal?.type === 'checkout_conflict') {
        localChangeChoice.value = 'stash';
    }
}, { immediate: true });

function handleAction(action: 'stash' | 'discard' | 'keep') {
    if (branchActionModal.value) {
        branchActionModal.value.onConfirm(action, inputValue.value.trim());
        branchActionModal.value = null;
    }
}

// Confirm a conflicting checkout: apply the chosen local-changes strategy.
function confirmCheckout() {
    handleAction(branchActionModal.value?.hasChanges ? localChangeChoice.value : 'keep');
}

function handleCancel() {
    branchActionModal.value = null;
}
</script>

<template>
  <Modal v-if="branchActionModal" :modelValue="true" @update:modelValue="!$event && handleCancel()" :title="branchActionModal.type === 'create_branch' ? t('modal.create_new_branch') : t('modal.checkout_branch')" width="480px">
    <div class="p-6">

      <!-- Create branch -->
      <template v-if="branchActionModal.type === 'create_branch'">
        <div class="space-y-2 mb-6">
          <span class="text-xs text-content-muted">{{ t('modal.branch_name') }}</span>
          <div class="relative w-full">
            <template v-if="generalSettings.highlightBranchPrefixes">
              <div class="absolute inset-0 pointer-events-none px-3 py-2 text-xs font-mono flex items-center whitespace-pre overflow-hidden" aria-hidden="true" v-if="inputValue">
                <div v-html="highlightedBranchName" class="translate-y-[1px]"></div>
              </div>
              <div class="absolute inset-0 pointer-events-none px-3 py-2 text-xs font-mono flex items-center whitespace-pre overflow-hidden text-neutral-600" aria-hidden="true" v-else>
                {{ t('modal.branch_name_placeholder') }}
              </div>
              <input ref="inputRef" v-model="inputValue" type="text" spellcheck="false" class="w-full relative z-10 bg-transparent border border-line-strong/50 rounded px-3 py-2 text-xs text-transparent caret-white focus:border-accent outline-none font-mono placeholder-transparent" :placeholder="t('modal.branch_name_placeholder')" @keydown.enter="handleAction('keep')" />
            </template>
            <template v-else>
              <input ref="inputRef" v-model="inputValue" type="text" spellcheck="false" class="w-full relative z-10 bg-surface border border-line-strong/50 rounded px-3 py-2 text-xs text-content-strong focus:border-accent outline-none placeholder-neutral-500" :placeholder="t('modal.branch_name_placeholder')" @keydown.enter="handleAction('keep')" />
            </template>
          </div>
        </div>
        <div class="flex justify-end gap-3">
          <button @click="handleCancel" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest border border-line-strong bg-surface text-content-muted hover:bg-surface-hover hover:text-content transition-all outline-none">{{ t('common.cancel') }}</button>
          <button @click="handleAction('keep')" :disabled="confirmDisabled" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest text-accent-fg bg-accent hover:bg-accent-hover shadow-lg transition-all outline-none disabled:opacity-30 disabled:cursor-not-allowed">{{ t('common.create') }}</button>
        </div>
      </template>

      <!-- Checkout branch (with optional local-changes handling) -->
      <template v-else>
        <div class="flex flex-col gap-3 mb-6 text-xs">
          <div class="flex items-center gap-3">
            <span class="w-32 shrink-0 text-right text-content-muted">{{ t('modal.branch_label') }}:</span>
            <span class="flex items-center gap-1.5 text-content-strong font-medium">
              <Icon icon="lucide:git-branch" class="w-3.5 h-3.5 text-content-muted" />{{ branchActionModal.targetBranch }}
            </span>
          </div>
          <div v-if="branchActionModal.hasChanges" class="flex items-center gap-3">
            <span class="w-32 shrink-0 text-right text-content-muted">{{ t('modal.local_changes_label') }}:</span>
            <div class="flex items-center gap-5">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="radio" value="stash" v-model="localChangeChoice" class="w-3.5 h-3.5" style="accent-color: rgb(var(--gb-accent))" />
                <span class="text-content">{{ t('modal.stash_reapply') }}</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="radio" value="discard" v-model="localChangeChoice" class="w-3.5 h-3.5" style="accent-color: rgb(var(--gb-accent))" />
                <span class="text-content">{{ t('modal.discard') }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3">
          <button @click="handleCancel" class="px-5 py-2 rounded text-xs font-bold uppercase tracking-widest border border-line-strong bg-surface text-content-muted hover:bg-surface-hover hover:text-content transition-all outline-none">{{ t('common.cancel') }}</button>
          <button @click="confirmCheckout"
                  class="px-6 py-2 rounded text-xs font-bold uppercase tracking-widest shadow-lg transition-all outline-none"
                  :class="branchActionModal.hasChanges && localChangeChoice === 'discard' ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' : 'bg-accent hover:bg-accent-hover text-accent-fg'">
            {{ t('common.ok') }}
          </button>
        </div>
      </template>

    </div>
  </Modal>
</template>



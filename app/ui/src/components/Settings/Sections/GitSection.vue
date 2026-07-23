<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { showToast } from '../../../services/toastService';
import Button from '../../Common/Button.vue';

const { t } = useI18n();

const draftName = ref('');
const draftEmail = ref('');
const isSavingGit = ref(false);
const saveSuccess = ref(false);

onMounted(async () => {
    try {
        const cfg = await window.gitbox.getGlobalConfig();
        draftName.value = cfg?.userName || '';
        draftEmail.value = cfg?.userEmail || '';
    } catch (err) {
        console.error('Failed to load global git config:', err);
    }
});

async function handleSaveGitConfig() {
    isSavingGit.value = true;
    saveSuccess.value = false;
    try {
        await window.gitbox.setGlobalConfig(draftName.value.trim(), draftEmail.value.trim());
        saveSuccess.value = true;
        setTimeout(() => saveSuccess.value = false, 2000);
    } catch (err: any) {
        showToast('Error', err?.message || String(err), 'error');
    } finally {
        isSavingGit.value = false;
    }
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-8 mb-2 border-b border-line">
    <div>
      <h2 class="text-xl font-bold text-content">{{ t('settings.git_config_title') }}</h2>
      <p class="text-[11px] text-content-muted mt-1">{{ t('settings.git_config_hint') }}</p>
    </div>
    <div>
      <label class="block text-xs font-bold text-content-muted uppercase mb-2">{{ t('settings.user_name') }}</label>
      <input v-model="draftName" type="text" placeholder="e.g. John Doe" class="w-full bg-surface border border-line rounded px-3 py-2 text-xs text-content-strong outline-none focus:border-accent transition-colors shadow-sm" />
    </div>
    <div>
      <label class="block text-xs font-bold text-content-muted uppercase mb-2">{{ t('settings.user_email') }}</label>
      <input v-model="draftEmail" type="text" placeholder="e.g. john@example.com" class="w-full bg-surface border border-line rounded px-3 py-2 text-xs text-content-strong outline-none focus:border-accent transition-colors shadow-sm" />
    </div>
    <div class="flex items-center gap-3 pt-2">
        <Button variant="primary" :loading="isSavingGit" @click="handleSaveGitConfig">
            {{ isSavingGit ? t('common.loading') : t('settings.save_git_config') }}
        </Button>
        <div v-if="saveSuccess" class="text-green-400 flex items-center gap-1.5 text-xs font-medium animate-in fade-in duration-300">
            <Icon icon="lucide:check-circle-2" class="w-4 h-4" />
            {{ t('settings.git_config_saved') || 'Saved to global git config (~/.gitconfig)' }}
        </div>
    </div>
  </div>
</template>

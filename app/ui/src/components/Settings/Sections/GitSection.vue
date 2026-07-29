<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { showToast } from '../../../services/toastService';
import { gravatarUrl } from '../../../utils/avatars';
import Button from '../../Common/Button.vue';

const { t } = useI18n();

const draftName = ref('');
const draftEmail = ref('');
const isSavingGit = ref(false);
const saveSuccess = ref(false);

/**
 * Email the avatar is showing. Trails the input by a moment on purpose: bound
 * straight to `draftEmail` it would fire a Gravatar request per keystroke, one
 * for every prefix of the address.
 */
const avatarEmail = ref('');
let avatarTimer: ReturnType<typeof setTimeout> | null = null;

watch(draftEmail, (email) => {
    if (avatarTimer) clearTimeout(avatarTimer);
    avatarTimer = setTimeout(() => { avatarEmail.value = email.trim(); }, 400);
});
onUnmounted(() => { if (avatarTimer) clearTimeout(avatarTimer); });

const avatarSrc = computed(() => gravatarUrl(avatarEmail.value));

function openGravatar() {
    window.gitbox?.openExternal('https://gravatar.com/profile');
}

onMounted(async () => {
    try {
        const cfg = await window.gitbox.getGlobalConfig();
        draftName.value = cfg?.userName || '';
        draftEmail.value = cfg?.userEmail || '';
        // Show the saved photo immediately — the debounce is only for typing.
        avatarEmail.value = draftEmail.value.trim();
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

    <!-- Sits under the email because that is what picks the photo: Gravatar keys
         off the address, and GitBox only ever reads it. -->
    <div>
      <label class="block text-xs font-bold text-content-muted uppercase mb-2">{{ t('settings.avatar_title') }}</label>
      <div class="flex items-start gap-4 bg-surface border border-line rounded p-4 shadow-sm">
        <img :src="avatarSrc" alt=""
             class="w-14 h-14 rounded-full border-2 border-line shadow-sm object-cover flex-shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-[11px] text-content-muted leading-relaxed">
            {{ avatarEmail ? t('settings.avatar_hint') : t('settings.avatar_no_email') }}
          </p>
          <button type="button" @click="openGravatar()"
                  class="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:underline">
            <Icon icon="lucide:external-link" class="w-3.5 h-3.5" />
            {{ t('settings.avatar_link') }}
          </button>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3 pt-2">
        <Button variant="primary" :loading="isSavingGit" @click="handleSaveGitConfig">
            {{ isSavingGit ? t('common.loading') : t('settings.save_git_config') }}
        </Button>
        <div v-if="saveSuccess" class="text-added flex items-center gap-1.5 text-xs font-medium animate-in fade-in duration-300">
            <Icon icon="lucide:check-circle-2" class="w-4 h-4" />
            {{ t('settings.git_config_saved') || 'Saved to global git config (~/.gitconfig)' }}
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { credentials, protection, loadCredentials, saveCredential, removeCredential, normalizeHost } from '../../../services/credentials';
import { requestConfirm } from '../../../services/modalService';
import { showToast } from '../../../services/toastService';

const { t } = useI18n();

const host = ref('');
const username = ref('');
const token = ref('');

const entries = computed(() => credentials.value);

// Credentials configured in git win over the ones typed here, so an entry the
// user added can end up unused. Rather than let that be invisible, ask the main
// process which hosts git answers for and label them.
const gitCovered = ref<Record<string, string>>({});

async function refreshGitCoverage() {
    const check = (window as any).gitbox?.gitCredentialCheck;
    if (!check) return;
    const found: Record<string, string> = {};
    for (const entry of entries.value) {
        try {
            const result = await check(entry.host);
            if (result?.covered) found[entry.host] = result.helper || 'git';
        } catch { /* leave the host unlabelled */ }
    }
    gitCovered.value = found;
}

onMounted(async () => { await loadCredentials(); await refreshGitCoverage(); });
watch(entries, refreshGitCoverage);

// The host field accepts a pasted clone URL too, so show what will actually be
// saved — otherwise a user types a URL, sees it stored as a bare host, and can't
// tell whether it matched.
const preview = computed(() => normalizeHost(host.value));
const canSave = computed(() => !!preview.value && !!token.value);

async function save() {
    if (!canSave.value) return;
    await saveCredential(host.value, username.value, token.value);
    showToast(t('common.success'), t('settings.credentials_saved', { host: preview.value }), 'success');
    host.value = '';
    username.value = '';
    token.value = '';
}

function remove(h: string) {
    requestConfirm(
        t('settings.credentials_remove_title', { host: h }),
        t('settings.credentials_remove_msg', { host: h }),
        true,
        () => { removeCredential(h); }
    );
}
</script>

<template>
  <section class="space-y-4">
    <label class="block text-xs font-bold text-content-muted uppercase flex items-center gap-2">
      <Icon icon="lucide:key-round" class="text-content-muted" />
      {{ t('settings.credentials') }}
    </label>
    <p class="text-[10px] text-content-muted leading-relaxed px-1">
      {{ t('settings.credentials_description') }}
    </p>
    <p class="text-[10px] leading-relaxed px-1 flex items-start gap-1.5"
       :class="protection === 'os' ? 'text-green-500' : 'text-amber-500'">
      <Icon :icon="protection === 'os' ? 'lucide:shield-check' : 'lucide:shield-alert'" class="w-3.5 h-3.5 shrink-0 mt-px" />
      {{ t(`settings.credentials_protection_${protection}`) }}
    </p>

    <!-- Saved hosts -->
    <div v-if="entries.length" class="grid grid-cols-1 gap-2">
      <div v-for="entry in entries" :key="entry.host"
           class="bg-surface border border-line rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center border border-line bg-surface-hover flex-shrink-0">
            <Icon icon="lucide:server" class="text-content-muted" />
          </div>
          <div class="min-w-0">
            <h3 class="text-xs font-bold text-content-strong truncate">{{ entry.host }}</h3>
            <span class="text-[9px] text-content-muted font-medium truncate">
              {{ entry.username || t('settings.credentials_no_user') }} · ••••••••
            </span>
            <span v-if="!entry.encrypted" class="ml-1 text-[8px] text-amber-500 uppercase font-black tracking-widest">
              {{ t('settings.credentials_unencrypted_tag') }}
            </span>
            <p v-if="gitCovered[entry.host]" class="mt-1 text-[9px] text-amber-500 flex items-center gap-1">
              <Icon icon="lucide:info" class="w-3 h-3 shrink-0" />
              {{ t('settings.credentials_git_overrides', { helper: gitCovered[entry.host] }) }}
            </p>
          </div>
        </div>
        <button @click="remove(entry.host)"
                class="px-3 py-2 hover:bg-red-900/40 text-content-muted hover:text-red-400 rounded text-[10px] font-bold transition-all flex items-center gap-1.5 border border-transparent hover:border-red-900/50 flex-shrink-0">
          <Icon icon="lucide:trash-2" class="w-3 h-3" />
          {{ t('common.remove') }}
        </button>
      </div>
    </div>

    <!-- Add / update -->
    <div class="bg-surface border border-line rounded-xl p-6 space-y-4">
      <div>
        <label class="block text-[10px] font-bold text-content-muted uppercase mb-2">{{ t('settings.credentials_host') }}</label>
        <input v-model="host" :placeholder="t('settings.credentials_host_placeholder')"
               class="w-full bg-app border border-line rounded px-3 py-2 text-xs text-content-strong outline-none focus:border-accent transition-colors shadow-sm" />
        <p v-if="preview && preview !== host.trim().toLowerCase()" class="mt-1.5 text-[9px] text-content-muted flex items-center gap-1">
          <Icon icon="lucide:corner-down-right" class="w-3 h-3 shrink-0" />
          {{ t('settings.credentials_host_normalized', { host: preview }) }}
        </p>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-content-muted uppercase mb-2">{{ t('settings.credentials_username') }}</label>
        <input v-model="username" :placeholder="t('settings.credentials_username_placeholder')"
               class="w-full bg-app border border-line rounded px-3 py-2 text-xs text-content-strong outline-none focus:border-accent transition-colors shadow-sm" />
      </div>
      <div>
        <label class="block text-[10px] font-bold text-content-muted uppercase mb-2">{{ t('settings.credentials_token') }}</label>
        <input v-model="token" type="password" :placeholder="t('settings.credentials_token_placeholder')"
               @keyup.enter="save()"
               class="w-full bg-app border border-line rounded px-3 py-2 text-xs text-content-strong outline-none focus:border-accent transition-colors shadow-sm" />
      </div>
      <div class="flex items-center justify-between gap-4 pt-1">
        <p class="text-[9px] text-content-muted leading-relaxed flex items-start gap-1.5">
          <Icon icon="lucide:shield-alert" class="w-3 h-3 shrink-0 mt-px" />
          {{ t('settings.credentials_transport_warning') }}
        </p>
        <button @click="save()" :disabled="!canSave"
                class="px-4 py-2 bg-accent/10 hover:bg-accent text-accent hover:text-accent-fg rounded text-[10px] font-bold transition-all flex items-center gap-1.5 border border-accent/20 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent/10 disabled:hover:text-accent">
          <Icon icon="lucide:plus" class="w-3 h-3" />
          {{ t('common.save') }}
        </button>
      </div>
    </div>
  </section>
</template>

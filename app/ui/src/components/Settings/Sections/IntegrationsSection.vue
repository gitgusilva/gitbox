<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { getItem, setItem } from '../../../services/storageService';
import { useIntegrations } from '../../../services/integrations';
import { notifyAiConfigChanged } from '../../../services/ai';
import { showToast } from '../../../services/toastService';
import Select from '../../Common/Select.vue';

const { t } = useI18n();

const aiProvider = ref('gemini');
const aiApiKey = ref('');
const isSavingAI = ref(false);

// AI CLIs detected on the machine (claude, gemini, codex, …). CLI providers use
// their own local auth, so they don't need an API key — only API providers do.
const aiClis = ref<{ id: string; label: string }[]>([]);

// Providers that authenticate via an API key (everything else is a local CLI).
const KEY_PROVIDERS = new Set(['gemini']);
const requiresKey = computed(() => KEY_PROVIDERS.has(aiProvider.value));

const providerOptions = computed(() => [
  { value: 'gemini', label: t('settings.gemini'), icon: 'lucide:sparkles' },
  ...aiClis.value.map(c => ({ value: 'cli:' + c.id, label: `${c.label} (CLI)`, icon: 'lucide:terminal' }))
]);

import { requestConfirm } from '../../../services/modalService';
const { list: integrationsList, connect: connectProvider, disconnect: disconnectProvider } = useIntegrations();

function handleDisconnect(providerId: string, name: string) {
    requestConfirm(
        t('settings.disconnect_confirm_title', { name }),
        t('settings.disconnect_confirm_msg', { name }),
        true,
        () => disconnectProvider(providerId)
    );
}

onMounted(async () => {
    aiProvider.value = getItem('gitbox_ai_provider') || 'gemini';
    aiApiKey.value = getItem('gitbox_ai_api_key') || '';
    try {
        aiClis.value = await (window as any).gitbox.detectAiClis();
    } catch {
        aiClis.value = [];
    }
});

let saveTimeout: any = null;

function autoSaveAIConfig() {
    isSavingAI.value = true;

    setItem('gitbox_ai_provider', aiProvider.value);
    setItem('gitbox_ai_api_key', aiApiKey.value);
    notifyAiConfigChanged();
    
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        isSavingAI.value = false;
        showToast('OK', t('settings.settings_saved'), 'success');
    }, 1000);
}

let isInitialLoad = true;

watch([aiProvider, aiApiKey], () => {
    if (isInitialLoad) {
        isInitialLoad = false;
        return;
    }
    autoSaveAIConfig();
});
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <!-- AI Section -->
    <section class="space-y-4">
      <label class="block text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
        <Icon icon="lucide:sparkles" class="text-blue-500" />
        {{ t('settings.ai') }}
      </label>
      <div class="bg-surface border border-line rounded-xl p-6 space-y-6">
        <div>
          <label class="block text-[10px] font-bold text-neutral-500 uppercase mb-2">{{ t('settings.ai_provider') }}</label>
          <Select v-model="aiProvider" :options="providerOptions" searchable />
        </div>
        <!-- API key: only for providers that authenticate with one. -->
        <div v-if="requiresKey">
          <label class="block text-[10px] font-bold text-neutral-500 uppercase mb-2">{{ t('settings.api_key') }}</label>
          <div class="relative">
            <input v-model="aiApiKey" type="password" :placeholder="t('settings.api_key_placeholder')" class="w-full bg-app border border-line rounded px-3 py-2 text-xs text-content-strong outline-none focus:border-accent transition-colors shadow-sm pr-10" />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Icon v-if="isSavingAI" icon="lucide:loader-2" class="w-3.5 h-3.5 animate-spin text-blue-500" />
              <Icon v-else icon="lucide:key" class="text-[10px] text-neutral-600" />
            </div>
          </div>
        </div>
        <!-- CLI providers use their own local login. -->
        <p v-else class="flex items-center gap-1.5 text-[10px] text-neutral-500">
          <Icon icon="lucide:terminal" class="text-xs shrink-0" />
          {{ t('settings.ai_cli_no_key') }}
        </p>
      </div>
    </section>

    <!-- External Providers Section -->
    <section class="space-y-4">
      <label class="block text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
        <Icon icon="lucide:link" class="text-neutral-500" />
        {{ t('settings.integrations') }}
      </label>
      <p class="text-[10px] text-neutral-500 leading-relaxed px-1">
        {{ t('settings.integrations_description') }}
      </p>
      
      <div class="grid grid-cols-1 gap-3">
        <div v-for="item in integrationsList" :key="item.id" 
             class="bg-surface border border-line rounded-xl p-4 flex items-center justify-between group hover:border-blue-500/30 hover:bg-neutral-200 dark:hover:bg-[#2A2A2B] transition-all shadow-sm">
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-2xl border border-neutral-200 dark:border-white/10 bg-white relative overflow-hidden flex-shrink-0" :style="{ color: item.color }">
              <div class="absolute inset-0 opacity-10" :style="{ background: `radial-gradient(circle at center, ${item.color}, transparent)` }"></div>
              <Icon :icon="item.icon" class="relative z-10" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <h3 class="text-xs font-bold text-content-strong">{{ item.name }}</h3>
                <span v-if="item.connected" class="text-[7px] bg-green-500/10 text-green-500 border border-green-500/20 px-1 py-0.5 rounded uppercase font-black tracking-widest">{{ t('common.active') }}</span>
              </div>
              <div v-if="item.connected" class="flex items-center gap-1.5">
                 <img v-if="item.user?.avatar_url" :src="item.user.avatar_url" class="w-3.5 h-3.5 rounded-full border border-white/10" />
                 <span class="text-[9px] text-content-muted font-medium truncate">@{{ item.user?.login || 'User' }}</span>
              </div>
              <p v-else class="text-[9px] text-neutral-500 leading-tight pr-4 truncate">
                {{ t('settings.integrations_desc_short') }}
              </p>
            </div>
          </div>
          
          <button v-if="!item.connected" 
                  @click="connectProvider(item.id)"
                  class="px-4 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-[10px] font-bold transition-all flex items-center gap-1.5 border border-blue-600/20 flex-shrink-0">
            <Icon icon="lucide:link-2" class="w-3 h-3" />
            {{ t('settings.connect') }}
          </button>
          <button v-else @click="handleDisconnect(item.id, item.name)"
                  class="px-4 py-2 hover:bg-red-900/40 text-neutral-500 hover:text-red-400 rounded text-[10px] font-bold transition-all flex items-center gap-1.5 border border-transparent hover:border-red-900/50 flex-shrink-0">
               <Icon icon="lucide:log-out" class="w-3 h-3" />
               {{ t('settings.disconnect') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

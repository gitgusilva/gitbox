<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { getItem, setItem } from '../../../services/storageService';
import { useIntegrations } from '../../../services/integrations';

const { t } = useI18n();

const aiProvider = ref('gemini');
const aiApiKey = ref('');
const isSavingAI = ref(false);
const saveAISuccess = ref(false);

import { requestConfirm } from '../../../services/modalService';
const { list: integrationsList, connect: connectProvider, disconnect: disconnectProvider } = useIntegrations();

function handleDisconnect(providerId: string, name: string) {
    requestConfirm(
        'Disconnect ' + name,
        `Are you sure you want to disconnect your ${name} account? You won't be able to see or create Pull Requests until you reconnect.`,
        true,
        () => disconnectProvider(providerId)
    );
}

onMounted(() => {
    aiProvider.value = getItem('gitbox_ai_provider') || 'gemini';
    aiApiKey.value = getItem('gitbox_ai_api_key') || '';
});

async function handleSaveAIConfig() {
    isSavingAI.value = true;
    saveAISuccess.value = false;
    
    setItem('gitbox_ai_provider', aiProvider.value);
    setItem('gitbox_ai_api_key', aiApiKey.value);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    isSavingAI.value = false;
    saveAISuccess.value = true;
    setTimeout(() => saveAISuccess.value = false, 2000);
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <!-- AI Section -->
    <section class="space-y-4">
      <label class="block text-xs font-bold text-neutral-500 uppercase flex items-center gap-2">
        <Icon icon="lucide:sparkles" class="text-blue-500" />
        {{ t('settings.ai') }}
      </label>
      <div class="bg-[#252526] border border-neutral-800 rounded-xl p-6 space-y-6">
        <div>
          <label class="block text-[10px] font-bold text-neutral-500 uppercase mb-2">{{ t('settings.ai_provider') }}</label>
          <select v-model="aiProvider" class="w-full bg-[#1e1e1e] border border-neutral-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors shadow-sm appearance-none cursor-pointer">
            <option value="gemini">{{ t('settings.gemini') }}</option>
          </select>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-neutral-500 uppercase mb-2">{{ t('settings.api_key') }}</label>
          <div class="relative">
            <input v-model="aiApiKey" type="password" :placeholder="t('settings.api_key_placeholder')" class="w-full bg-[#1e1e1e] border border-neutral-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors shadow-sm pr-10" />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-600">
              <Icon icon="lucide:key" class="text-[10px]" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 pt-2">
            <button @click="handleSaveAIConfig" :disabled="isSavingAI" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors shadow-md flex items-center gap-2">
                <Icon v-if="isSavingAI" icon="lucide:loader-2" class="animate-spin" />
                {{ isSavingAI ? t('common.loading') : 'Save AI Config' }}
            </button>
            <div v-if="saveAISuccess" class="text-green-400 flex items-center gap-1.5 text-xs font-medium animate-in fade-in duration-300">
                <Icon icon="lucide:check-circle-2" class="w-4 h-4" />
                AI Settings saved!
            </div>
        </div>
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
             class="bg-[#252526] border border-neutral-800 rounded-xl p-4 flex items-center justify-between group hover:border-blue-500/30 hover:bg-[#2A2A2B] transition-all shadow-sm">
          <div class="flex items-center gap-4 min-w-0">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-2xl border border-white/5 relative overflow-hidden flex-shrink-0" :style="{ backgroundColor: item.color + '15', color: item.color }">
              <div class="absolute inset-0 opacity-10" :style="{ background: `radial-gradient(circle at center, ${item.color}, transparent)` }"></div>
              <Icon :icon="item.icon" class="relative z-10" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <h3 class="text-xs font-bold text-white">{{ item.name }}</h3>
                <span v-if="item.connected" class="text-[7px] bg-green-500/10 text-green-500 border border-green-500/20 px-1 py-0.5 rounded uppercase font-black tracking-widest">{{ t('common.active') }}</span>
              </div>
              <div v-if="item.connected" class="flex items-center gap-1.5">
                 <img v-if="item.user?.avatar_url" :src="item.user.avatar_url" class="w-3.5 h-3.5 rounded-full border border-white/10" />
                 <span class="text-[9px] text-neutral-400 font-medium truncate">@{{ item.user?.login || 'User' }}</span>
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
                     class="px-3 py-1.5 hover:bg-red-900/40 text-neutral-500 hover:text-red-400 rounded text-[9px] font-bold transition-all flex items-center gap-1.5 border border-transparent hover:border-red-900/50 flex-shrink-0">
               <Icon icon="lucide:log-out" class="w-3 h-3" />
               {{ t('settings.disconnect') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

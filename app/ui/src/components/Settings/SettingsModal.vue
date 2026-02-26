<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../services/themeService';
import { getItem, setItem } from '../../services/storageService';
import { activeTab } from '../../services/gitService';
import { activeWorkspaceId } from '../../services/workspaceService';

const { t, locale } = useI18n();
const { currentTheme, applyTheme } = useTheme();

const emit = defineEmits(['close']);

const activeSection = ref('appearance');

const languages = [
  { code: 'en', name: 'English' },
  { code: 'pt-br', name: 'Português (Brasil)' },
  { code: 'es', name: 'Español' }
];

import { userName, userEmail, setGitConfig } from '../../services/gitService';

const draftName = ref('');
const draftEmail = ref('');
const isSavingGit = ref(false);
const saveSuccess = ref(false);

onMounted(() => {
    draftName.value = userName.value;
    draftEmail.value = userEmail.value;
});

async function handleSaveGitConfig() {
    isSavingGit.value = true;
    saveSuccess.value = false;
    await setGitConfig(draftName.value, draftEmail.value);
    isSavingGit.value = false;
    saveSuccess.value = true;
    setTimeout(() => saveSuccess.value = false, 2000);
}

function changeLanguage(lang: string) {
  locale.value = lang;
  setItem('gitbox_locale', lang);
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
    <div class="bg-[#1E1E1E] border border-neutral-800 rounded-lg shadow-2xl w-[700px] h-[500px] flex overflow-hidden scale-in-center">
      
      <!-- Sidebar de Configurações -->
      <aside class="w-48 bg-[#252526] border-r border-neutral-800 p-2 flex flex-col gap-1">
        <h2 class="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{{ t('settings.title') }}</h2>
        
        <button @click="activeSection = 'appearance'" 
                class="flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors"
                :class="activeSection === 'appearance' ? 'bg-[#37373D] text-white font-bold' : 'text-neutral-400 hover:bg-neutral-800'">
          <Icon icon="lucide:palette" /> {{ t('settings.appearance') }}
        </button>
        
        <button @click="activeSection = 'git'" 
                class="flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors"
                :class="activeSection === 'git' ? 'bg-[#37373D] text-white font-bold' : 'text-neutral-400 hover:bg-neutral-800'">
          <Icon icon="lucide:git-branch" /> {{ t('settings.git') }}
        </button>
      </aside>

      <!-- Conteúdo de Configurações -->
      <main class="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        <header class="h-12 border-b border-neutral-800 flex items-center justify-between px-6 bg-[#252526]">
          <h1 class="font-bold text-sm text-neutral-200">
            {{ activeSection === 'appearance' ? t('settings.appearance') : t('settings.git') }}
          </h1>
          <button @click="emit('close')" class="text-neutral-500 hover:text-white transition-colors">
            <Icon icon="lucide:x" class="text-lg" />
          </button>
        </header>

        <div class="flex-1 p-8 overflow-y-auto overflow-x-hidden">
          <!-- Appearance Section -->
          <div v-if="activeSection === 'appearance'" class="space-y-8">
            <section>
              <label class="block text-xs font-bold text-neutral-500 uppercase mb-4">{{ t('settings.theme') }}</label>
              <div class="grid grid-cols-3 gap-3">
                <button v-for="theme in ['light', 'dark', 'system'] as const" 
                        :key="theme"
                        @click="applyTheme(theme)"
                        class="flex flex-col items-center gap-2 p-4 rounded-lg border transition-all"
                        :class="currentTheme === theme ? 'bg-blue-600/10 border-blue-600 text-blue-400' : 'bg-[#252526] border-neutral-800 text-neutral-500 hover:border-neutral-700'">
                  <Icon :icon="theme === 'light' ? 'lucide:sun' : (theme === 'dark' ? 'lucide:moon' : 'lucide:monitor')" class="text-xl" />
                  <span class="text-xs font-medium">{{ t(`settings.${theme}`) }}</span>
                </button>
              </div>
            </section>

            <section>
              <label class="block text-xs font-bold text-neutral-500 uppercase mb-4">{{ t('settings.language') }}</label>
              <div class="space-y-2">
                <div v-for="lang in languages" :key="lang.code" 
                     @click="changeLanguage(lang.code)"
                     class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
                     :class="locale === lang.code ? 'bg-[#2D2D2D] border-neutral-600 text-white font-bold' : 'bg-[#252526] border-neutral-800 text-neutral-400 hover:border-neutral-700'">
                  <div class="flex items-center gap-3">
                    <Icon icon="lucide:languages" class="text-sm" />
                    <span class="text-xs">{{ lang.name }}</span>
                  </div>
                  <Icon v-if="locale === lang.code" icon="lucide:check" class="text-blue-500" />
                </div>
              </div>
            </section>

            <section class="pt-4 border-t border-neutral-800">
               <button @click="activeWorkspaceId = 'changelog'; emit('close')" class="w-full flex items-center justify-between px-4 py-3 bg-[#252526] border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors group">
                  <div class="flex items-center gap-3">
                    <Icon icon="lucide:megaphone" class="text-blue-500" />
                    <span class="text-xs font-bold text-neutral-300">What's New in GitBox</span>
                  </div>
                  <Icon icon="lucide:chevron-right" class="text-neutral-600 group-hover:text-neutral-400" />
               </button>
            </section>
          </div>

          <!-- Git Section -->
          <div v-if="activeSection === 'git'" class="space-y-6">
            <div>
              <label class="block text-xs font-bold text-neutral-500 uppercase mb-2">{{ t('settings.user_name') }}</label>
              <input v-model="draftName" type="text" placeholder="e.g. John Doe" class="w-full bg-[#252526] border border-neutral-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors shadow-sm" />
            </div>
            <div>
              <label class="block text-xs font-bold text-neutral-500 uppercase mb-2">{{ t('settings.user_email') }}</label>
              <input v-model="draftEmail" type="text" placeholder="e.g. john@example.com" class="w-full bg-[#252526] border border-neutral-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors shadow-sm" />
            </div>
            <div class="flex items-center gap-3 pt-2">
                <button @click="handleSaveGitConfig" :disabled="isSavingGit" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors shadow-md flex items-center gap-2">
                    <Icon v-if="isSavingGit" icon="lucide:loader-2" class="animate-spin" />
                    {{ isSavingGit ? 'Saving...' : 'Save Configuration' }}
                </button>
                <div v-if="saveSuccess" class="text-green-400 flex items-center gap-1.5 text-xs font-medium animate-in fade-in duration-300">
                    <Icon icon="lucide:check-circle-2" class="w-4 h-4" />
                    Saved globally for this repository!
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.scale-in-center {
	animation: scale-in-center 0.1s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
}
@keyframes scale-in-center {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>

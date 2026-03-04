<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from '../../../services/themeService';
import { useLanguage } from '../../../services/languageService';
import { generalSettings } from '../../../services/settingsService';
import { formatDate } from '../../../utils/formatters';
import RangeSlider from '../../Common/RangeSlider.vue';
import Checkbox from '../../Common/Checkbox.vue';

const { t, locale } = useI18n();
const { currentTheme, applyTheme } = useTheme();
const { languages, changeLanguage } = useLanguage();

const emit = defineEmits(['close']);

function handleLanguageChange(lang: string) {
  changeLanguage(lang);
  locale.value = lang;
}

const dateFormats = [
  'yyyy/MM/dd, HH:mm:ss',
  'yyyy.MM.dd, HH:mm:ss',
  'yyyy-MM-dd, HH:mm:ss',
  'MM/dd/yyyy, HH:mm:ss',
  'MM.dd.yyyy, HH:mm:ss',
  'MM-dd-yyyy, HH:mm:ss',
  'dd/MM/yyyy, HH:mm:ss',
  'dd.MM.yyyy, HH:mm:ss',
  'dd-MM-yyyy, HH:mm:ss',
  'MMM d yyyy, HH:mm:ss',
  'd MMM yyyy, HH:mm:ss'
];

const sampleTime = Date.now() / 1000;
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
    
    <!-- Appearance & Language -->
    <div class="flex flex-col gap-8">
      <section>
        <label class="block text-xs font-bold text-neutral-500 uppercase mb-4">{{ t('settings.theme') }}</label>
        <div class="grid grid-cols-3 gap-2">
          <button v-for="theme in ['light', 'dark', 'system'] as const" 
                  :key="theme"
                  @click="applyTheme(theme)"
                  class="flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all"
                  :class="currentTheme === theme ? 'bg-blue-600/10 border-blue-600 text-blue-400' : 'bg-[#252526] border-neutral-800 text-neutral-500 hover:border-neutral-700'">
            <Icon :icon="theme === 'light' ? 'lucide:sun' : (theme === 'dark' ? 'lucide:moon' : 'lucide:monitor')" class="text-lg" />
            <span class="text-[10px] font-medium">{{ t(`settings.${theme}`) }}</span>
          </button>
        </div>
      </section>

      <section>
        <label class="block text-xs font-bold text-neutral-500 uppercase mb-4">{{ t('settings.language') }}</label>
        <div class="relative group/select">
            <select :value="locale" @change="handleLanguageChange(($event.target as HTMLSelectElement).value)" class="w-full bg-[#252526] border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-300 outline-none focus:border-blue-500 appearance-none cursor-pointer group-hover/select:border-neutral-700 transition-all">
                <option v-for="lang in languages" :key="lang.code" :value="lang.code">
                    {{ lang.name }}
                </option>
            </select>
            <Icon icon="lucide:chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
        </div>
      </section>
    </div>

    <!-- Date & History Settings -->
    <section class="space-y-6 pt-4 border-t border-neutral-800/50">
      <div class="flex items-center justify-between gap-4">
          <div class="flex-1">
              <label class="block text-xs font-bold text-neutral-500 uppercase mb-2">{{ t('settings.date_format') }}</label>
              <div class="relative group/select">
                  <select v-model="generalSettings.dateFormat" class="w-full bg-[#252526] border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-300 outline-none focus:border-blue-500 appearance-none cursor-pointer group-hover/select:border-neutral-700 font-mono transition-all">
                      <option v-for="fmt in dateFormats" :key="fmt" :value="fmt">
                          {{ formatDate(sampleTime, fmt) }} &nbsp;&nbsp;&nbsp; ({{ fmt }})
                      </option>
                  </select>
                  <Icon icon="lucide:chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
              </div>
          </div>
      </div>

      <div>
          <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-bold text-neutral-500 uppercase">{{ t('settings.auto_fetch_interval') }}</label>
              <span class="text-[11px] font-mono text-blue-400">{{ generalSettings.autoFetchInterval === 0 ? 'Disabled' : generalSettings.autoFetchInterval + ' min' }}</span>
          </div>
          <div class="flex flex-col gap-2 group/range w-full pt-1">
              <RangeSlider 
                 v-model="generalSettings.autoFetchInterval" 
                 :min="0" 
                 :max="60" 
                 :step="1" 
              >
                  <div class="flex justify-between w-full px-1 text-[8px] text-neutral-700 font-mono pointer-events-none mt-1">
                      <span>0 (Off)</span>
                      <span>60 min</span>
                  </div>
              </RangeSlider>
              <p class="text-[10px] text-neutral-500 leading-relaxed">
                  {{ t('settings.auto_fetch_desc') }}
              </p>
          </div>
      </div>

      <div>
          <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-bold text-neutral-500 uppercase">{{ t('settings.history_commits') }}</label>
              <span class="text-[11px] font-mono text-blue-400">{{ generalSettings.historyCount }}</span>
          </div>
          <div class="flex items-center gap-4 group/range w-full pt-1">
              <RangeSlider 
                 v-model="generalSettings.historyCount" 
                 :min="500" 
                 :max="10000" 
                 :step="500" 
              >
                  <div class="flex justify-between w-full px-1 text-[8px] text-neutral-700 font-mono pointer-events-none mt-1">
                      <span>500</span>
                      <span>10k</span>
                  </div>
              </RangeSlider>
          </div>
      </div>
    </section>

    <!-- Checkboxes -->
    <section class="space-y-4 pt-4 border-t border-neutral-800/50">
        <Checkbox v-model="generalSettings.showTagsInGraph" :label="t('settings.show_tags_graph')" />
        <Checkbox v-model="generalSettings.checkForUpdates" :label="t('settings.check_updates_startup')" />
        <Checkbox v-model="generalSettings.hideIconLabels" :label="t('settings.hide_icon_labels')" />
        <Checkbox v-model="generalSettings.highlightBranchPrefixes" :label="t('settings.highlight_branch_prefixes')" />
        <Checkbox v-model="generalSettings.showClosedPRs" :label="t('settings.show_closed_prs') || 'Show Closed PRs'" />
        <Checkbox v-model="generalSettings.rememberTabs" :label="t('settings.remember_tabs') || 'Remember Tabs'" />
    </section>

  </div>
</template>



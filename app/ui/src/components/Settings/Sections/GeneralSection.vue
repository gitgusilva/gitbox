<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLanguage } from '../../../services/languageService';
import { generalSettings } from '../../../services/settingsService';
import { formatDate } from '../../../utils/formatters';
import RangeSlider from '../../Common/RangeSlider.vue';
import Checkbox from '../../Common/Checkbox.vue';
import Select from '../../Common/Select.vue';
import UpdatesSection from './UpdatesSection.vue';

const { t, locale } = useI18n();

const { languages, changeLanguage } = useLanguage();

const emit = defineEmits(['close']);

function handleLanguageChange(lang: string | string[]) {
  const code = Array.isArray(lang) ? lang[0] : lang;
  changeLanguage(code);
  locale.value = code;
}

const languageOptions = computed(() => {
    return languages.map(l => ({ value: l.code, label: l.name }));
});

const dateFormats = [
  'relative',
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

const formatOptions = computed(() => dateFormats.map(fmt => fmt === 'relative'
  ? { value: fmt, label: `${t('settings.date_format_relative')}    (${t('time.days_ago', { count: 2 })}…)` }
  : { value: fmt, label: `${formatDate(sampleTime, fmt)}    (${fmt})` }));

const notificationPositionOptions = computed(() => [
  { value: 'bottom-right', label: t('settings.pos_bottom_right') },
  { value: 'bottom-left', label: t('settings.pos_bottom_left') },
  { value: 'top-right', label: t('settings.pos_top_right') },
  { value: 'top-left', label: t('settings.pos_top_left') },
]);
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
    
    <!-- Appearance & Language -->
    <div class="flex flex-col gap-8">
      <section>
        <label class="block text-xs font-bold text-content-muted uppercase mb-4">{{ t('settings.language') }}</label>
        <Select :modelValue="locale" @update:modelValue="handleLanguageChange" :options="languageOptions" class="w-full" searchable />
      </section>
    </div>

    <!-- Date & History Settings -->
    <section class="space-y-6 pt-4 border-t border-line/50">
      <div class="flex items-center justify-between gap-4">
          <div class="flex-1">
              <label class="block text-xs font-bold text-content-muted uppercase mb-2">{{ t('settings.date_format') }}</label>
              <Select v-model="generalSettings.dateFormat" :options="formatOptions" searchable />
          </div>
      </div>

      <div>
          <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-bold text-content-muted uppercase">{{ t('settings.auto_fetch_interval') }}</label>
              <span class="text-[11px] font-mono text-accent">{{ generalSettings.autoFetchInterval === 0 ? 'Disabled' : generalSettings.autoFetchInterval + ' min' }}</span>
          </div>
          <div class="flex flex-col gap-2 group/range w-full pt-1">
              <RangeSlider 
                 v-model="generalSettings.autoFetchInterval" 
                 :min="0" 
                 :max="60" 
                 :step="1" 
              >
                  <div class="flex justify-between w-full px-1 text-[8px] text-content-muted font-mono pointer-events-none mt-1">
                      <span>0 (Off)</span>
                      <span>60 min</span>
                  </div>
              </RangeSlider>
              <p class="text-[10px] text-content-muted leading-relaxed">
                  {{ t('settings.auto_fetch_desc') }}
              </p>
          </div>
      </div>

      <div>
          <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-bold text-content-muted uppercase">{{ t('settings.history_commits') }}</label>
              <span class="text-[11px] font-mono text-accent">{{ generalSettings.historyCount }}</span>
          </div>
          <div class="flex items-center gap-4 group/range w-full pt-1">
              <RangeSlider 
                 v-model="generalSettings.historyCount" 
                 :min="500" 
                 :max="10000" 
                 :step="500" 
              >
                  <div class="flex justify-between w-full px-1 text-[8px] text-content-muted font-mono pointer-events-none mt-1">
                      <span>500</span>
                      <span>10k</span>
                  </div>
              </RangeSlider>
          </div>
      </div>
    </section>

    <!-- Checkboxes -->
    <section class="space-y-4 pt-4 border-t border-line/50">
        <Checkbox v-model="generalSettings.showTagsInGraph" :label="t('settings.show_tags_graph')" />
        <Checkbox v-model="generalSettings.checkForUpdates" :label="t('settings.check_updates_startup')" />
        <Checkbox v-model="generalSettings.hideIconLabels" :label="t('settings.hide_icon_labels')" />
        <Checkbox v-model="generalSettings.highlightBranchPrefixes" :label="t('settings.highlight_branch_prefixes')" />
        <Checkbox v-model="generalSettings.showClosedPRs" :label="t('settings.show_closed_prs') || 'Show Closed PRs'" />
        <Checkbox v-model="generalSettings.rememberTabs" :label="t('settings.remember_tabs') || 'Remember Tabs'" />
    </section>

    <!-- Notifications -->
    <section class="space-y-4 pt-4 border-t border-line/50">
        <label class="block text-xs font-bold text-content-muted uppercase">{{ t('settings.notifications') }}</label>
        <Checkbox v-model="generalSettings.notificationsEnabled" :label="t('settings.notifications_enabled')" />
        <div :class="generalSettings.notificationsEnabled ? '' : 'opacity-40 pointer-events-none'">
            <label class="block text-[11px] font-medium text-content-muted mb-2">{{ t('settings.notification_position') }}</label>
            <Select v-model="generalSettings.notificationPosition" :options="notificationPositionOptions" searchable class="w-full" />
        </div>
    </section>

    <!-- Updates (kept last) -->
    <div class="pt-4 border-t border-line/50">
        <UpdatesSection />
    </div>

  </div>
</template>



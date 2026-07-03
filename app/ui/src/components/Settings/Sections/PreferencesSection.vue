<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import Select from '../../Common/Select.vue';
import Tooltip from '../../Common/Tooltip.vue';
import { generalSettings } from '../../../services/settingsService';
import { onMounted, ref, computed } from 'vue';

const { t } = useI18n();

const mergeLayoutOptions = computed(() => [
    { value: 'columns', label: t('settings.merge_layout_columns') },
    { value: 'stacked', label: t('settings.merge_layout_stacked') },
]);

const diffToolOptions = ref([
    { value: 'use_merge_tool', label: '<Use Merge Tool>' },
    { value: 'none', label: '<None>' },
    { value: 'git_config_default', label: 'Git Config Default' },
    { value: 'custom', label: '<Custom>' }
]);

const mergeToolOptions = ref([
    { value: 'gitbox', label: 'GitBox (Built-in)' },
    { value: 'git_config_default', label: 'Git Config Default' },
    { value: 'none', label: '<None>' },
    { value: 'custom', label: '<Custom>' }
]);

const editorOptions = ref([
    { value: 'none', label: '<None>' },
    { value: 'custom', label: '<Custom>' }
]);

const terminalOptions = ref([
    { value: 'none', label: '<None>' },
    { value: 'custom', label: '<Custom>' }
]);

onMounted(async () => {
    // @ts-ignore
    if (window.gitbox?.detectExternalTools) {
        // @ts-ignore
        const tools = await window.gitbox.detectExternalTools();
        if (tools.editors) editorOptions.value.push(...tools.editors);
        if (tools.terminals) terminalOptions.value.push(...tools.terminals);
        if (tools.mergeTools) mergeToolOptions.value.push(...tools.mergeTools);
    }
});
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <!-- External Tools Section -->
    <section class="space-y-6">
      <h2 class="text-xl font-bold text-content">
        {{ t('settings.external_tools') }}
      </h2>
      
      <div class="flex flex-col gap-6">

        <!-- Merge Tool -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
            {{ t('settings.merge_tool') }}
            <Tooltip :text="t('settings.external_merge_tool')">
              <Icon icon="lucide:help-circle" class="text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalMergeTool" :options="mergeToolOptions" class="w-full" />
        </div>

        <!-- Diff Tool -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
            {{ t('settings.diff_tool') }}
            <Tooltip :text="t('settings.external_diff_tool')">
              <Icon icon="lucide:help-circle" class="text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalDiffTool" :options="diffToolOptions" class="w-full" />
        </div>

        <!-- Editor -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
            {{ t('settings.editor') }}
            <Tooltip :text="t('settings.external_editor')">
              <Icon icon="lucide:help-circle" class="text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalEditor" :options="editorOptions" class="w-full" />
        </div>

        <!-- Terminal -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
            {{ t('settings.terminal') }}
            <Tooltip :text="t('settings.external_terminal')">
              <Icon icon="lucide:help-circle" class="text-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalTerminal" :options="terminalOptions" class="w-full" />
        </div>

      </div>
    </section>

    <!-- Merge editor Section -->
    <section class="space-y-6">
      <h2 class="text-xl font-bold text-content">
        {{ t('settings.merge_editor') }}
      </h2>
      <div class="flex flex-col gap-6">
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase mb-2">
            {{ t('settings.merge_layout') }}
          </label>
          <Select v-model="generalSettings.mergeLayout" :options="mergeLayoutOptions" class="w-full" />
          <p class="text-[11px] text-content-muted mt-2">{{ t('settings.merge_layout_hint') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

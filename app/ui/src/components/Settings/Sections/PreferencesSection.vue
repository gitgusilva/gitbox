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

// Tools auto-detected on the machine (populated onMounted). The lists below combine
// the meaningful built-in choices with whatever is installed. Dropped the old
// "<Custom>" (there is no custom-command field, so it did nothing) and redundant
// "<None>" entries where a clearer default already exists.
const detectedEditors = ref<{ value: string, label: string }[]>([]);
const detectedTerminals = ref<{ value: string, label: string }[]>([]);
const detectedMerge = ref<{ value: string, label: string }[]>([]);
const detectedDiff = ref<{ value: string, label: string }[]>([]);

const mergeToolOptions = computed(() => [
    { value: 'gitbox', label: t('settings.tool_gitbox_builtin') },
    { value: 'git_config_default', label: t('settings.tool_git_default') },
    ...detectedMerge.value,
]);

const diffToolOptions = computed(() => [
    { value: 'use_merge_tool', label: t('settings.tool_use_merge') },
    { value: 'git_config_default', label: t('settings.tool_git_default') },
    ...detectedDiff.value,
]);

const editorOptions = computed(() => [
    { value: 'none', label: t('settings.tool_none') },
    ...detectedEditors.value,
]);

const terminalOptions = computed(() => (
    // The detected list already leads with "GitBox Integrated Terminal".
    detectedTerminals.value.length
        ? detectedTerminals.value
        : [{ value: 'gitbox', label: 'GitBox Integrated Terminal' }]
));

onMounted(async () => {
    // @ts-ignore
    if (window.gitbox?.detectExternalTools) {
        // @ts-ignore
        const tools = await window.gitbox.detectExternalTools();
        if (tools.editors) detectedEditors.value = tools.editors;
        if (tools.terminals) detectedTerminals.value = tools.terminals;
        if (tools.mergeTools) detectedMerge.value = tools.mergeTools;
        if (tools.diffTools) detectedDiff.value = tools.diffTools;
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
          <label class="flex items-center gap-1.5 text-xs font-bold text-content-muted uppercase mb-2">
            {{ t('settings.merge_tool') }}
            <Tooltip :text="t('settings.external_merge_tool')">
              <Icon icon="lucide:help-circle" class="text-content-muted hover:text-content-strong text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalMergeTool" :options="mergeToolOptions" searchable class="w-full" />
        </div>

        <!-- Diff Tool -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-content-muted uppercase mb-2">
            {{ t('settings.diff_tool') }}
            <Tooltip :text="t('settings.external_diff_tool')">
              <Icon icon="lucide:help-circle" class="text-content-muted hover:text-content-strong text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalDiffTool" :options="diffToolOptions" searchable class="w-full" />
        </div>

        <!-- Editor -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-content-muted uppercase mb-2">
            {{ t('settings.editor') }}
            <Tooltip :text="t('settings.external_editor')">
              <Icon icon="lucide:help-circle" class="text-content-muted hover:text-content-strong text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalEditor" :options="editorOptions" searchable class="w-full" />
        </div>

        <!-- Terminal -->
        <div>
          <label class="flex items-center gap-1.5 text-xs font-bold text-content-muted uppercase mb-2">
            {{ t('settings.terminal') }}
            <Tooltip :text="t('settings.external_terminal')">
              <Icon icon="lucide:help-circle" class="text-content-muted hover:text-content-strong text-sm cursor-help normal-case" />
            </Tooltip>
          </label>
          <Select v-model="generalSettings.externalTerminal" :options="terminalOptions" searchable class="w-full" />
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
          <label class="flex items-center gap-1.5 text-xs font-bold text-content-muted uppercase mb-2">
            {{ t('settings.merge_layout') }}
          </label>
          <Select v-model="generalSettings.mergeLayout" :options="mergeLayoutOptions" searchable class="w-full" />
          <p class="text-[11px] text-content-muted mt-2">{{ t('settings.merge_layout_hint') }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

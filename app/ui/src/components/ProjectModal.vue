<script setup lang="ts">
/**
 * Create / edit a project: name and colour in one place.
 *
 * Driven by `projectModal` in modalService — `{ mode: 'create' }` or
 * `{ mode: 'edit', id }` — and mounted once in AppLayout alongside the other
 * modals, so it survives the project popover closing under it.
 */
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { projectModal } from '../services/modalService';
import { projects, updateProject, PROJECT_COLORS, DEFAULT_PROJECT_COLOR } from '../services/projectService';
import { createAndSwitchProject } from '../services/workspaceService';
import Modal from './Common/Modal.vue';
import Button from './Common/Button.vue';
import ColorPicker from './Common/ColorPicker.vue';

const { t } = useI18n();

const name = ref('');
const color = ref(DEFAULT_PROJECT_COLOR);
const nameInput = ref<HTMLInputElement | null>(null);

const isEdit = computed(() => projectModal.value?.mode === 'edit');
const isOpen = computed({
    get: () => !!projectModal.value,
    set: (v: boolean) => { if (!v) projectModal.value = null; }
});

watch(projectModal, (m) => {
    if (!m) return;
    const existing = m.mode === 'edit' ? projects.value.find(p => p.id === m.id) : null;
    name.value = existing ? (existing.name || t('project.default_name')) : '';
    // A fresh project pre-picks the next palette colour; the user can change it.
    color.value = existing ? existing.color : PROJECT_COLORS[projects.value.length % PROJECT_COLORS.length];
    nextTick(() => nameInput.value?.focus());
}, { immediate: true });

function submit() {
    const trimmed = name.value.trim();
    if (!trimmed) return;
    const m = projectModal.value;
    if (!m) return;

    if (m.mode === 'edit' && m.id) updateProject(m.id, { name: trimmed, color: color.value });
    else createAndSwitchProject(trimmed, color.value);

    projectModal.value = null;
}
</script>

<template>
  <Modal
    v-model="isOpen"
    :title="isEdit ? t('project.edit') : t('project.new')"
    icon="lucide:folders"
    :iconColor="'text-accent'"
    width="440px"
  >
    <div class="v-stack gap-5 px-6 py-5">
      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2">
          {{ t('project.name_label') }}
        </label>
        <input
          ref="nameInput"
          v-model="name"
          :placeholder="t('project.name_placeholder')"
          @keydown.enter="submit"
          class="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-line-strong text-content placeholder:text-content-muted outline-none focus:border-accent transition-colors"
        />
        <p class="mt-2 text-[11px] text-content-muted leading-relaxed">{{ t('project.new_message') }}</p>
      </div>

      <div>
        <label class="block text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2">
          {{ t('project.color_label') }}
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in PROJECT_COLORS" :key="c"
            @click="color = c"
            class="w-7 h-7 rounded-lg transition-transform hover:scale-110"
            :class="color === c ? 'ring-2 ring-offset-2 ring-offset-app ring-content-strong' : 'border border-line-strong'"
            :style="{ backgroundColor: c }"
          ></button>
        </div>
        <div class="mt-3">
          <ColorPicker v-model="color" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="h-stack justify-end gap-2">
        <Button variant="ghost" @click="projectModal = null">{{ t('common.cancel') }}</Button>
        <Button variant="primary" :disabled="!name.trim()" @click="submit">
          {{ isEdit ? (t('common.save') || 'Save') : (t('common.create') || 'Create') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

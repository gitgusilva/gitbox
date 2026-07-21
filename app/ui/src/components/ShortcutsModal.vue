<script setup lang="ts">
/**
 * Keyboard shortcuts sheet.
 *
 * Grouped by the category each shortcut registers with, two columns on wide
 * screens, with a filter — the old version dumped every entry into a single
 * "global" list because that was the only category anyone passed.
 */
import { ref, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { isShortcutsModalOpen } from '../services/modalService';
import { getShortcutsRegistry, type ShortcutMeta } from '../services/shortcutService';
import Modal from './Common/Modal.vue';
import SearchInput from './Common/SearchInput.vue';

const { t } = useI18n();
const query = ref('');

/** Display order; anything registered under an unknown category lands in "other". */
const CATEGORY_ORDER = ['app', 'projects', 'tabs', 'repository', 'view', 'terminal', 'editor', 'other'];

const CATEGORY_ICONS: Record<string, string> = {
    app: 'lucide:app-window',
    projects: 'lucide:folders',
    tabs: 'lucide:columns-3',
    repository: 'lucide:git-branch',
    view: 'lucide:layout',
    terminal: 'lucide:terminal',
    editor: 'lucide:file-code',
    other: 'lucide:more-horizontal'
};

/** Human label for one shortcut row. */
function labelOf(item: ShortcutMeta): string {
    if (item.titleKey) return t(item.titleKey);
    return item.descriptionKey || item.pattern;
}

/** Keys to draw, honouring a range's collapsed display (e.g. "alt+1…9"). */
function keysOf(item: ShortcutMeta): string[] {
    return (item.displayPattern || item.pattern).split('+');
}

const groups = computed(() => {
    const q = query.value.trim().toLowerCase();
    const all = getShortcutsRegistry().filter(item => {
        if (!q) return true;
        return labelOf(item).toLowerCase().includes(q)
            || (item.displayPattern || item.pattern).toLowerCase().includes(q);
    });

    return CATEGORY_ORDER
        .map(category => ({
            category,
            items: all.filter(i => (i.category || 'other') === category)
        }))
        .filter(g => g.items.length > 0);
});

const total = computed(() => groups.value.reduce((n, g) => n + g.items.length, 0));
</script>

<template>
  <Modal
    v-model="isShortcutsModalOpen"
    :title="t('shortcuts.title')"
    icon="lucide:keyboard"
    iconColor="text-accent"
    width="720px"
    maxHeight="80vh"
  >
    <div class="v-stack min-h-0">
      <div class="px-6 py-4 border-b border-line bg-surface shrink-0">
        <SearchInput v-model="query" :placeholder="t('shortcuts.search')" />
      </div>

      <div class="px-6 py-5">
        <div v-if="total === 0" class="py-10 center text-xs text-content-muted">
          {{ t('shortcuts.empty') }}
        </div>

        <!-- Two columns so a long list stays readable instead of scrolling forever -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 items-start">
          <section v-for="g in groups" :key="g.category" class="v-stack gap-2">
            <div class="h-stack items-center gap-2">
              <Icon :icon="CATEGORY_ICONS[g.category]" class="w-3.5 h-3.5 text-accent shrink-0" />
              <span class="text-[10px] font-bold uppercase tracking-widest text-content-muted">
                {{ t('shortcuts.categories.' + g.category) }}
              </span>
              <div class="h-px bg-line flex-1"></div>
            </div>

            <div
              v-for="(item, idx) in g.items" :key="idx"
              class="h-stack items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface border border-line/50"
            >
              <span class="text-[11px] font-medium text-content min-w-0 truncate">{{ labelOf(item) }}</span>
              <!-- "+" between keys: "ALT 1…9" side by side reads as two separate
                   keys rather than one combination. -->
              <div class="h-stack items-center gap-1 shrink-0">
                <template v-for="(key, kIdx) in keysOf(item)" :key="kIdx">
                  <span v-if="kIdx > 0" class="text-[10px] font-bold text-content-muted/60 select-none">+</span>
                  <kbd
                    class="bg-app border border-line text-content-muted px-1.5 py-0.5 rounded text-[10px] uppercase font-bold min-w-[20px] text-center"
                  >{{ key }}</kbd>
                </template>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Modal>
</template>

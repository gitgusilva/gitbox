<script setup lang="ts">
/**
 * Appearance settings: a single theme gallery that merges the local themes
 * (built-in defaults + imported/installed) with the remote theme repository.
 * Themes are applied on click, installed from the repository, or imported from
 * a JSON file. To customize a theme, export it, edit the JSON, and import it
 * back — there is no in-app editor.
 */
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import {
  allThemes, activeTheme,
  selectTheme, deleteTheme, exportTheme, importTheme,
} from '../../../services/themeService';
import {
  registryThemes, registryLoading, registryError,
  ensureRegistry, refreshRegistry, installRegistryTheme,
  previewCache, resolvePreview,
} from '../../../services/themeRegistry';
import type { RegistryEntry } from '../../../services/themeRegistry';
import type { ThemeColors, GitboxTheme } from '../../../types/theme';
import { showToast } from '../../../services/toastService';
import { getItem, setItem } from '../../../services/storageService';
import Tooltip from '../../Common/Tooltip.vue';

const { t } = useI18n();

// Unified theme gallery: local themes (built-in defaults + installed) merged
// with repository themes, deduped by name+type. Local themes apply on click;
// repository-only themes are installed. One searchable, filterable place.
const search = ref('');
const typeFilter = ref<'all' | 'dark' | 'light'>('all');
const installingId = ref<string | null>(null);

// Preview URLs that failed to load (404, offline, broken host). A card whose
// image errors falls back to the colour-swatch tile instead of showing a broken
// image, so a missing screenshot never leaves a hole in the gallery.

onMounted(() => { ensureRegistry(); });

const swatchKeys: (keyof ThemeColors)[] = ['bg', 'bgElevated', 'accent', 'added', 'removed', 'modified'];
const keyOf = (name: string, type: string) => `${name.trim().toLowerCase()}|${type}`;

interface ThemeCard {
  key: string;
  name: string;
  type: 'light' | 'dark';
  author?: string;
  colors: ThemeColors;
  previewUrl?: string;
  local?: GitboxTheme;
  entry?: RegistryEntry;
}

const galleryCards = computed<ThemeCard[]>(() => {
  const registryByKey = new Map<string, RegistryEntry>();
  for (const e of registryThemes.value) registryByKey.set(keyOf(e.name, e.type), e);

  const cards: ThemeCard[] = [];
  const matched = new Set<string>();

  // Local themes first — always available, including offline. A matching
  // registry entry lends its preview image to the card.
  for (const th of allThemes.value) {
    const k = keyOf(th.name, th.type);
    const entry = registryByKey.get(k);
    if (entry) matched.add(k);
    cards.push({
      key: th.id,
      name: th.name,
      type: th.type,
      author: th.meta?.author,
      colors: th.colors,
      previewUrl: entry?.previewUrl,
      local: th,
      entry,
    });
  }
  // Repository themes that are not installed yet.
  for (const e of registryThemes.value) {
    const k = keyOf(e.name, e.type);
    if (matched.has(k)) continue;
    cards.push({ key: `repo:${e.id}`, name: e.name, type: e.type, author: e.author, colors: e.colors, previewUrl: e.previewUrl, entry: e });
  }
  return cards;
});

// Favorites are keyed by name+type so they survive install (registry -> local).
const FAVORITES_KEY = 'gitbox_theme_favorites';
function loadFavorites(): Set<string> {
  try { const raw = getItem(FAVORITES_KEY); return new Set<string>(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
}
const favorites = ref<Set<string>>(loadFavorites());
const isFavorite = (c: ThemeCard) => favorites.value.has(keyOf(c.name, c.type));
function toggleFavorite(c: ThemeCard) {
  const k = keyOf(c.name, c.type);
  const next = new Set(favorites.value);
  if (next.has(k)) next.delete(k); else next.add(k);
  favorites.value = next;
  setItem(FAVORITES_KEY, JSON.stringify([...next]));
}

const filteredCards = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = galleryCards.value.filter((c) => {
    if (typeFilter.value !== 'all' && c.type !== typeFilter.value) return false;
    if (!q) return true;
    return `${c.name} ${c.author ?? ''}`.toLowerCase().includes(q);
  });
  // Favorites first; stable sort keeps the original order within each group.
  return list.sort((a, b) => (isFavorite(b) ? 1 : 0) - (isFavorite(a) ? 1 : 0));
});

// Warm the disk cache for every visible preview so images render offline.
watch(galleryCards, (cards) => {
  for (const c of cards) if (c.previewUrl) resolvePreview(c.previewUrl);
}, { immediate: true });

const isActive = (c: ThemeCard) => !!c.local && activeTheme.value.id === c.local.id;

function onCardClick(c: ThemeCard) {
  if (c.local) selectTheme(c.local);
  else installCard(c);
}
function installCard(c: ThemeCard) {
  if (c.entry) onInstall(c.entry);
}

async function onExport() {
  const theme = activeTheme.value;
  const name = theme.name.replace(/\s+/g, '-').toLowerCase() || 'theme';
  const result = await window.gitbox.saveTextFile(`${name}.json`, exportTheme(theme));
  if (result.saved) showToast(t('common.success'), t('appearance.exported'), 'success');
}

async function onImport() {
  const file = await window.gitbox.openTextFile();
  if (!file) return;
  const imported = importTheme(file.content);
  showToast(
    imported ? t('common.success') : t('common.error'),
    imported ? t('appearance.imported') : t('appearance.import_failed'),
    imported ? 'success' : 'error',
  );
}

/** The community theme registry — where users publish/contribute themes. */
const REGISTRY_REPO_URL = 'https://github.com/gitgusilva/gitbox-themes';
function openRegistryRepo() {
  window.gitbox?.openExternal?.(REGISTRY_REPO_URL);
}

async function onInstall(entry: RegistryEntry) {
  installingId.value = entry.id;
  try {
    const theme = await installRegistryTheme(entry);
    showToast(
      theme ? t('common.success') : t('common.error'),
      theme ? t('appearance.installed_ok', { name: entry.name }) : t('appearance.install_failed'),
      theme ? 'success' : 'error',
    );
  } catch {
    showToast(t('common.error'), t('appearance.install_failed'), 'error');
  } finally {
    installingId.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <!-- Themes: local defaults/installed + repository, unified -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-baseline gap-2">
          <h3 class="text-[11px] font-bold uppercase tracking-widest text-content-muted">{{ t('appearance.custom_themes') }}</h3>
          <span v-if="registryLoading" class="text-[9px] text-content-muted">{{ t('appearance.loading') }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button @click="onImport" class="px-2 py-1 text-[10px] rounded border border-line-strong text-content hover:bg-surface-hover flex items-center gap-1">
            <Icon icon="lucide:upload" class="w-3 h-3" /> {{ t('appearance.import') }}
          </button>
          <button @click="onExport" class="px-2 py-1 text-[10px] rounded border border-line-strong text-content hover:bg-surface-hover flex items-center gap-1">
            <Icon icon="lucide:download" class="w-3 h-3" /> {{ t('appearance.export') }}
          </button>
          <button @click="refreshRegistry()" :disabled="registryLoading"
                  class="px-2 py-1 text-[10px] rounded border border-line-strong text-content hover:bg-surface-hover flex items-center gap-1 disabled:opacity-50">
            <Icon icon="lucide:refresh-cw" class="w-3 h-3" :class="registryLoading ? 'animate-spin' : ''" /> {{ t('appearance.refresh') }}
          </button>
        </div>
      </div>

      <!-- Search + filter -->
      <div class="flex items-center gap-2 mb-3">
        <div class="relative flex-1">
          <Icon icon="lucide:search" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
          <input v-model="search" :placeholder="t('appearance.search')"
                 class="w-full h-8 pl-8 pr-2 text-[11px] rounded-lg border border-line-strong bg-app text-content focus:outline-none focus:border-accent" />
        </div>
        <div class="flex rounded-lg border border-line-strong overflow-hidden text-[10px] shrink-0">
          <button v-for="f in (['all', 'dark', 'light'] as const)" :key="f" @click="typeFilter = f"
                  class="px-2.5 py-1.5 transition-colors"
                  :class="typeFilter === f ? 'bg-accent text-accent-fg' : 'text-content-muted hover:bg-surface-hover'">
            {{ f === 'all' ? t('appearance.all') : t(`appearance.mode_${f}`) }}
          </button>
        </div>
      </div>

      <!-- Offline note: local/default themes still show; new fetches unavailable -->
      <div v-if="registryError" class="text-[10px] text-content-muted mb-2 flex items-center gap-1.5">
        <Icon icon="lucide:wifi-off" class="w-3 h-3 shrink-0" />
        {{ registryThemes.length > 0 ? t('appearance.repo_offline_cached') : t('appearance.repo_offline') }}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div v-for="card in filteredCards" :key="card.key"
             @click="onCardClick(card)"
             @dragstart.prevent
             class="group rounded-lg border overflow-hidden flex flex-col cursor-pointer transition-all select-none"
             :class="isActive(card) ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-line-strong'">
          <div class="relative aspect-[720/460] bg-surface overflow-hidden">
            <img v-if="card.previewUrl && previewCache[card.previewUrl]" :src="previewCache[card.previewUrl]!" :alt="card.name" draggable="false" class="w-full h-full object-cover object-top pointer-events-none select-none" />
            <!-- Skeleton while the preview is still resolving (real loading only). -->
            <div v-else-if="card.previewUrl && previewCache[card.previewUrl] === undefined" class="w-full h-full bg-surface-hover animate-pulse" />
            <!-- Colors fallback: shown only after loading finished with no image, or when the theme has no preview. -->
            <div v-else class="w-full h-full flex flex-col pointer-events-none" :style="{ background: card.colors.bg }">
              <div class="flex items-center gap-1 px-2 py-1.5" :style="{ background: card.colors.bgElevated, borderBottom: `1px solid ${card.colors.border}` }">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: card.colors.accent }" />
                <span class="h-1.5 rounded-full w-2/5" :style="{ background: card.colors.textMuted, opacity: 0.5 }" />
              </div>
              <div class="flex-1 px-2.5 py-2 flex flex-col justify-center gap-[6px]">
                <div class="flex items-center gap-1.5">
                  <span class="h-1.5 w-3 rounded-sm shrink-0" :style="{ background: card.colors.textMuted, opacity: 0.6 }" />
                  <span class="h-1.5 rounded-sm" :style="{ background: card.colors.text, width: '55%', opacity: 0.85 }" />
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="h-1.5 w-3 rounded-sm shrink-0" :style="{ background: card.colors.added }" />
                  <span class="h-1.5 rounded-sm" :style="{ background: card.colors.added, width: '42%', opacity: 0.7 }" />
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="h-1.5 w-3 rounded-sm shrink-0" :style="{ background: card.colors.removed }" />
                  <span class="h-1.5 rounded-sm" :style="{ background: card.colors.removed, width: '50%', opacity: 0.7 }" />
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="h-1.5 w-3 rounded-sm shrink-0" :style="{ background: card.colors.modified }" />
                  <span class="h-1.5 rounded-sm" :style="{ background: card.colors.text, width: '62%', opacity: 0.75 }" />
                </div>
              </div>
            </div>
            <span class="absolute top-1.5 right-1.5 text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-overlay/85 text-content-muted">{{ card.type }}</span>
            <div v-if="isActive(card)" class="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-accent text-accent-fg flex items-center justify-center">
              <Icon icon="lucide:check" class="w-3 h-3" />
            </div>
            <Tooltip v-if="card.local && !card.local.builtin" :text="t('common.delete')" position="top" class="absolute bottom-1.5 right-1.5">
              <button @click.stop="card.local && deleteTheme(card.local.id)"
                      class="w-5 h-5 rounded flex items-center justify-center bg-overlay/80 text-content-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <Icon icon="lucide:x" class="w-3 h-3" />
              </button>
            </Tooltip>
            <Tooltip :text="isFavorite(card) ? t('appearance.unfavorite') : t('appearance.favorite')" position="top" class="absolute bottom-1.5 left-1.5">
              <button @click.stop="toggleFavorite(card)"
                      class="w-5 h-5 rounded flex items-center justify-center bg-overlay/80 transition-all"
                      :class="isFavorite(card) ? 'text-accent' : 'text-content-muted opacity-0 group-hover:opacity-100 hover:text-content'">
                <Icon icon="lucide:star" class="w-3 h-3" :class="isFavorite(card) ? 'fill-current' : ''" />
              </button>
            </Tooltip>
          </div>
          <div class="p-2 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] font-medium text-content truncate">{{ card.name }}</span>
              <span v-if="isActive(card)" class="text-[8px] uppercase tracking-wide text-accent shrink-0">{{ t('appearance.active') }}</span>
            </div>
            <div v-if="card.author" class="text-[9px] text-content-muted truncate">{{ t('appearance.by', { author: card.author }) }}</div>
            <button v-if="!card.local" @click.stop="installCard(card)" :disabled="installingId === card.entry?.id"
                    class="mt-1 h-7 rounded text-[10px] font-medium flex items-center justify-center gap-1 bg-accent text-accent-fg hover:bg-accent-hover transition-colors disabled:opacity-60">
              <Icon :icon="installingId === card.entry?.id ? 'lucide:loader-2' : 'lucide:download'" class="w-3 h-3" :class="installingId === card.entry?.id ? 'animate-spin' : ''" />
              {{ installingId === card.entry?.id ? t('appearance.installing') : t('appearance.install') }}
            </button>
          </div>
        </div>

        <!-- Publish a theme: opens the community registry repo -->
        <button @click="openRegistryRepo"
                class="rounded-lg border border-dashed border-line hover:border-accent hover:text-accent flex flex-col items-center justify-center gap-1.5 p-2.5 text-content-muted min-h-[120px] transition-colors">
          <Icon icon="lucide:github" class="w-5 h-5" />
          <span class="text-[10px] font-medium flex items-center gap-1">
            {{ t('appearance.publish_theme') }} <Icon icon="lucide:external-link" class="w-2.5 h-2.5" />
          </span>
        </button>
      </div>

      <div v-if="filteredCards.length === 0" class="mt-2 flex items-center gap-2">
        <p class="text-[11px] text-content-muted">{{ t('appearance.no_match') }}</p>
        <button @click="onImport" class="px-2 py-1 text-[10px] rounded border border-line-strong text-content hover:bg-surface-hover flex items-center gap-1">
          <Icon icon="lucide:upload" class="w-3 h-3" /> {{ t('appearance.import_local') }}
        </button>
      </div>

      <p class="text-[10px] text-content-muted mt-3 flex items-center gap-1.5">
        <Icon icon="lucide:info" class="w-3 h-3 shrink-0" /> {{ t('appearance.customize_hint') }}
      </p>
    </section>
  </div>
</template>

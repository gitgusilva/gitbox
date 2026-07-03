<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import ScrollArea from '../components/Common/ScrollArea.vue';
import { tags } from '../services/gitService';

const { t } = useI18n();

const props = defineProps<{
    version: string;
}>();

const changelogContent = ref('');
const isLoading = ref(false);
const hasUpdate = ref(false);

const fallbackChanges = computed(() => [
    {
        type: 'feature',
        title: t('view.fallback_file_tree_title'),
        description: t('view.fallback_file_tree_desc')
    },
    {
        type: 'feature',
        title: t('view.fallback_git_config_title'),
        description: t('view.fallback_git_config_desc')
    },
    {
        type: 'improvement',
        title: t('view.fallback_history_title'),
        description: t('view.fallback_history_desc')
    }
]);

async function loadChangelog() {
    isLoading.value = true;
    try {
        const content = await window.gitbox.getAppChangelog();
        changelogContent.value = content;
        
        // Check for updates: look for tags higher than current version
        if (tags.value.length > 0) {
            const latestTag = tags.value[tags.value.length - 1].name.replace('v', '');
            if (latestTag !== props.version) {
                hasUpdate.value = true;
            }
        }
    } catch (e) {
        changelogContent.value = '';
    } finally {
        isLoading.value = false;
    }
}

onMounted(loadChangelog);

function parseMarkdown(md: string) {
    if (!md) return [];
    const lines = md.split('\n');
    const items: any[] = [];
    let currentVersionContent = false;
    
    lines.forEach(line => {
        if (line.startsWith('## ')) {
            const title = line.replace('## ', '').trim();
            items.push({ type: 'version', title });
        } else if (line.startsWith('### ')) {
            const type = line.replace('### ', '').trim().toLowerCase();
            items.push({ type: 'category', title: type });
        } else if (line.startsWith('- ')) {
            const desc = line.replace('- ', '').trim();
            items.push({ type: 'item', description: desc });
        }
    });
    return items;
}

const parsedChanges = computed(() => parseMarkdown(changelogContent.value));

const getIconForCategory = (cat: string) => {
    if (cat.includes('added')) return 'lucide:sparkles';
    if (cat.includes('fixed') || cat.includes('bug')) return 'lucide:bug';
    if (cat.includes('improved')) return 'lucide:zap';
    return 'lucide:info';
};

const getColorForCategory = (cat: string) => {
    if (cat.includes('added')) return 'text-green-400 bg-green-500/10 border-green-500/20';
    if (cat.includes('fixed') || cat.includes('bug')) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (cat.includes('improved')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-content-muted bg-neutral-500/10 border-neutral-500/20';
};
</script>

<template>
  <div class="flex-1 flex flex-col bg-app overflow-hidden">
    <!-- Header -->
    <div class="p-8 border-b border-line bg-surface flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-6">
            <div class="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 relative">
                <Icon icon="lucide:rocket" class="text-3xl text-white animate-bounce-slow" />
                <div v-if="hasUpdate" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-line animate-pulse"></div>
            </div>
            <div>
                <div class="text-xs uppercase tracking-[0.2em] font-black text-blue-500 mb-1">{{ t('view.release_notes') }}</div>
                <h1 class="text-3xl font-black text-content-strong">{{ t('view.project_changelog') }}</h1>
            </div>
        </div>
        <div class="text-right">
            <div class="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-bold">{{ t('view.local_version') }}</div>
            <span class="text-lg font-mono bg-neutral-200 dark:bg-neutral-800 border border-line-strong px-4 py-1.5 rounded-full text-content">v{{ version }}</span>
        </div>
    </div>

    <!-- Content -->
    <ScrollArea class="flex-1">
        <div class="max-w-4xl mx-auto p-12 py-16 flex flex-col gap-1">
            <template v-if="parsedChanges.length > 0">
                <div v-for="(item, idx) in parsedChanges" :key="idx">
                    <div v-if="item.type === 'version'" class="mt-12 mb-6 flex items-center gap-4">
                        <h2 class="text-2xl font-black text-content-strong px-4 py-1 bg-neutral-200 dark:bg-neutral-800 rounded-lg border border-line-strong">{{ item.title }}</h2>
                        <div class="h-px flex-1 bg-neutral-200 dark:bg-neutral-800"></div>
                    </div>
                    <div v-else-if="item.type === 'category'" class="mt-8 mb-4 flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center border" :class="getColorForCategory(item.title)">
                            <Icon :icon="getIconForCategory(item.title)" class="text-sm" />
                        </div>
                        <span class="text-xs font-black uppercase tracking-widest" :class="getColorForCategory(item.title).split(' ')[0]">{{ item.title }}</span>
                    </div>
                    <div v-else-if="item.type === 'item'" class="flex gap-4 mb-3 group pl-10 border-l border-line ml-4 py-1">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0 group-hover:scale-150 transition-transform"></div>
                        <p class="text-sm text-content-muted group-hover:text-neutral-800 dark:group-hover:text-neutral-200 transition-colors leading-relaxed">{{ item.description }}</p>
                    </div>
                </div>
            </template>
            <template v-else-if="isLoading">
                <div class="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Icon icon="lucide:loader-2" class="text-4xl text-blue-500 animate-spin" />
                    <span class="text-xs uppercase tracking-widest font-black text-neutral-500">{{ t('view.retrieving_from_git') }}</span>
                </div>
            </template>
            <template v-else>
                <!-- Fallback to hardcoded list if no CHANGELOG.md found -->
                <div class="text-center mb-16 opacity-30 italic text-neutral-500 text-xs">{{ t('view.no_changelog_found') }}</div>
                <div v-for="(change, idx) in fallbackChanges" :key="idx" class="flex gap-8 group mb-12">
                    <div class="mt-1 flex-shrink-0">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center border text-blue-400 bg-blue-500/10 border-blue-500/20 group-hover:scale-110 transition-all shadow-lg">
                            <Icon icon="lucide:star" class="text-xl" />
                        </div>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">{{ t('view.feature') }}</span>
                            <h2 class="text-lg font-bold text-content-strong">{{ change.title }}</h2>
                        </div>
                        <p class="text-sm text-content-muted leading-relaxed max-w-2xl">{{ change.description }}</p>
                        <div class="h-px w-full bg-gradient-to-r from-neutral-800 to-transparent mt-8"></div>
                    </div>
                </div>
            </template>

            <!-- Footer -->
            <div class="mt-16 p-12 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex flex-col items-center text-center">
                <Icon icon="lucide:sparkles" class="text-4xl text-blue-400 mb-6 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <h3 class="text-2xl font-bold text-content-strong mb-3">{{ t('view.keep_evolving') }}</h3>
                <p class="text-content-muted text-sm max-w-md leading-relaxed">{{ t('view.keep_evolving_desc') }}</p>
            </div>
        </div>
    </ScrollArea>
  </div>
</template>

<style scoped>
@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
.animate-bounce-slow {
  animation: bounce-slow 3s infinite ease-in-out;
}


</style>

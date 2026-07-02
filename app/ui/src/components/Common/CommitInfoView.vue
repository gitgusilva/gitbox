<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import ScrollArea from './ScrollArea.vue';
import VirtualScroll from './VirtualScroll.vue';
import { Commit } from '../../types/git';
import { gravatarUrl } from '../../utils/avatars';
import { formatFullDate, renderMessageLinks, handleLinkClick } from '../../utils/formatters';
import { startMarquee, stopMarquee } from '../../utils/dom';
import { historyDetailInfoHeight, layoutRefs } from '../../services/layoutService';
import Tooltip from './Tooltip.vue';
import Resizer from './Resizer.vue';
import { cn } from '../../utils/cn';

const { t } = useI18n();

/**
 * Component to display detailed information about a Git commit.
 * Includes author, committer, SHA, parents, refs, and the commit message.
 * Optionally displays the list of changed files.
 */
const props = defineProps<{
  /** The commit data object. */
  commit: Commit;
  /** List of references (branches, tags) associated with this commit. */
  commitRefs: { name: string, type: 'branch' | 'tag' | 'remote', isHead?: boolean }[];
  /** List of files changed in this commit. */
  changedFiles: any[];
  /** Whether to show the changed files section. Default is true. */
  showFiles?: boolean;
  /** Optional title to display at the top. */
  title?: string;
  /** Custom CSS class for the root container. */
  class?: string;
}>();

const emit = defineEmits<{
  /** Emitted when a parent commit or reference is clicked for navigation. */
  (e: 'navigate', commit: any): void;
  /** Emitted when a changed file is clicked. */
  (e: 'selectFile', path: string): void;
}>();

/**
 * Returns the appropriate icon for a file status.
 * @param {string} status - File status (e.g., 'added', 'modified').
 * @returns {string} Iconify icon name.
 */
function getStatusIcon(status: string) {
  if (!status) return 'lucide:file';
  const s = status.toLowerCase();
  if (s.indexOf('untracked') !== -1 || s.indexOf('added') !== -1 || s.indexOf('new') !== -1) return 'lucide:plus';
  if (s.indexOf('deleted') !== -1) return 'lucide:minus';
  if (s.indexOf('renamed') !== -1 || s.indexOf('moved') !== -1) return 'lucide:repeat';
  if (s.indexOf('modified') !== -1 || s.indexOf('staged') !== -1) return 'lucide:file-text';
  return 'lucide:file';
}

/**
 * Returns the tailwind color class for a file status.
 * @param {string} status - File status string.
 * @returns {string} Tailwind CSS color class.
 */
function getStatusColor(status: string) {
  if (!status) return 'text-neutral-500';
  const s = status.toLowerCase();
  if (s.indexOf('untracked') !== -1 || s.indexOf('added') !== -1 || s.indexOf('new') !== -1) return 'text-green-500';
  if (s.indexOf('deleted') !== -1) return 'text-red-500';
  if (s.indexOf('renamed') !== -1 || s.indexOf('moved') !== -1) return 'text-purple-400';
  if (s.indexOf('modified') !== -1 || s.indexOf('staged') !== -1) return 'text-[#E2B93D]';
  return 'text-neutral-500';
}
</script>

<template>
  <div :class="cn('h-full w-full v-stack min-h-0 bg-neutral-100 dark:bg-[#242424]', props.class)">
    <!-- Upper section: metadata and message -->
    <ScrollArea 
      v-if="commit"
      :style="{ height: (showFiles === false ? '100%' : (layoutRefs.detailsWidth.value ? historyDetailInfoHeight : 400) + 'px') }" 
      class="flex-shrink-0 bg-white dark:bg-[#242424]"
      :auto-hide="false"
    >
      <div class="p-6 v-stack gap-6 overflow-x-hidden">

        <!-- Header: Authors -->
        <div class="v-stack gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
            <div class="h-stack items-start gap-4">
              <div class="relative flex-shrink-0">
                <img :src="gravatarUrl(commit.authorEmail)" class="w-12 h-12 rounded border-2 border-neutral-200 dark:border-neutral-800 shadow-sm dark:shadow-lg object-cover" />
                <div class="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white dark:border-[#242424]"></div>
              </div>
              <div class="v-stack min-w-0 flex-1">
                <div class="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase font-black tracking-widest mb-0.5">{{ t('history_detail.author') }}</div>
                <Tooltip :text="commit.author">
                  <div class="font-bold text-black dark:text-neutral-100 text-xs min-w-0 w-full truncate">
                     {{ commit.author }}
                  </div>
                </Tooltip>
                <Tooltip :text="commit.authorEmail">
                  <div class="text-neutral-400 dark:text-neutral-500 font-normal text-xs mb-1 min-w-0 w-full truncate">
                     &lt;{{ commit.authorEmail }}&gt;
                  </div>
                </Tooltip>
                <div class="text-[10px] text-neutral-500">{{ formatFullDate(commit.timestamp) }}</div>
              </div>
            </div>

            <div class="h-stack items-start gap-4" v-if="(commit.committer && commit.committer !== commit.author) || (commit.committerEmail && commit.committerEmail !== commit.authorEmail)">
              <div v-if="commit.committer?.toLowerCase() === 'github' || commit.committerEmail?.toLowerCase().includes('github')" class="w-12 h-12 rounded bg-neutral-200 dark:bg-[#24292e] text-black dark:text-white center border-2 border-neutral-300 dark:border-neutral-800 shadow-lg opacity-80 flex-shrink-0">
                  <Icon icon="mdi:github" class="text-3xl" />
              </div>
              <div v-else-if="commit.committer?.toLowerCase() === 'gitlab' || commit.committerEmail?.toLowerCase().includes('gitlab')" class="w-12 h-12 rounded bg-[#e24329] text-white center border-2 border-neutral-200 dark:border-neutral-800 shadow-lg opacity-80 flex-shrink-0">
                  <Icon icon="mdi:gitlab" class="text-3xl" />
              </div>
              <div v-else-if="commit.committer?.toLowerCase() === 'bitbucket' || commit.committerEmail?.toLowerCase().includes('bitbucket')" class="w-12 h-12 rounded bg-[#0052cc] text-white center border-2 border-neutral-200 dark:border-neutral-800 shadow-lg opacity-80 flex-shrink-0">
                  <Icon icon="mdi:bitbucket" class="text-3xl" />
              </div>
              <img v-else :src="gravatarUrl(commit.committerEmail || commit.authorEmail)" class="w-12 h-12 rounded border-2 border-neutral-200 dark:border-neutral-800 shadow-lg opacity-80 object-cover flex-shrink-0" />
              
              <div class="v-stack min-w-0 flex-1">
                <div class="text-[9px] text-neutral-500 uppercase font-black tracking-widest mb-0.5">{{ t('history_detail.committer') }}</div>
                <Tooltip :text="commit.committer || commit.author">
                  <div class="font-bold text-neutral-300 dark:text-neutral-300 text-xs min-w-0 w-full truncate">
                     {{ commit.committer || commit.author }}
                  </div>
                </Tooltip>
                <Tooltip v-if="commit.committerEmail" :text="commit.committerEmail">
                  <div class="text-neutral-500 font-normal text-xs mb-1 min-w-0 w-full truncate">
                     &lt;{{ commit.committerEmail }}&gt;
                  </div>
                </Tooltip>
                <div class="text-[10px] text-neutral-600">{{ formatFullDate(commit.committerTimestamp || commit.timestamp) }}</div>
              </div>
            </div>
        </div>

        <!-- Metadata Grid -->
        <div class="v-stack gap-4 text-[11px]">
            <div class="h-stack items-start">
               <div class="w-20 shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-1">{{ t('history_detail.sha') }}</div>
               <div class="flex-1 h-stack gap-2 bg-neutral-100 dark:bg-[#1E1E1E] px-2 py-1 rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  <span class="font-mono text-neutral-700 dark:text-neutral-300 truncate text-[10px]">{{ commit.id }}</span>
               </div>
            </div>

            <div v-if="commit.parents && commit.parents.length" class="h-stack items-start">
               <div class="w-20 shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-1">{{ t('history_detail.parents') }}</div>
               <div class="flex-1 flex flex-wrap gap-2">
                  <button v-for="p in commit.parents" :key="p.id" 
                          @click="emit('navigate', p)"
                          class="text-blue-400 font-mono hover:text-blue-300 transition-colors border-b border-blue-900 border-dashed text-[10px]">
                    {{ p.id.substring(0, 8) }}
                  </button>
               </div>
            </div>

            <div v-if="commitRefs.length > 0" class="h-stack items-start">
               <div class="w-20 shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-1">{{ t('history_detail.refs') }}</div>
               <div class="flex-1 flex flex-wrap gap-2">
                  <span v-for="ref in commitRefs" :key="ref.name" 
                        class="h-stack gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border"
                        :class="[
                          ref.type === 'branch' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30' : 
                          ref.type === 'remote' ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' :
                          'bg-yellow-900/20 text-yellow-500 border-yellow-500/30'
                        ]">
                     <Icon :icon="ref.isHead ? 'lucide:check-circle-2' : (ref.type === 'branch' ? 'lucide:git-branch' : (ref.type === 'remote' ? 'lucide:cloud' : 'lucide:tag'))" class="text-[10px]" />
                     {{ ref.name }}
                  </span>
               </div>
            </div>

            <div class="h-stack items-start">
               <div class="w-20 shrink-0 text-neutral-500 font-bold uppercase tracking-widest text-[9px] pt-1">{{ t('history_detail.message') }}</div>
               <div class="flex-1 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed min-w-0">
                  <div class="font-bold text-black dark:text-neutral-100 mb-2 text-xs truncate">{{ commit.summary }}</div>
                  <div v-html="renderMessageLinks(commit.message || '')" @click="handleLinkClick" class="opacity-80 text-[11px] overflow-hidden"></div>
               </div>
            </div>
        </div>
      </div>
    </ScrollArea>
    <div v-else class="center flex-1 h-full opacity-20 text-[10px] uppercase font-bold tracking-widest py-20">
       {{ t('history_detail.no_commit_selected') }}
    </div>

    <!-- Resizer -->
    <Resizer vertical v-if="showFiles !== false" :target="layoutRefs.historyDetailInfoHeight" :options="{ axis: 'y', min: 150 }" class="bg-neutral-200/50 dark:bg-neutral-800/50" />

    <!-- Lower section: Changed files -->
    <div v-if="showFiles !== false" class="flex-1 v-stack min-h-0 bg-neutral-50 dark:bg-[#1A1A1A] overflow-hidden">
        <div class="p-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-[#252526] h-stack justify-between flex-shrink-0">
            <div class="text-neutral-500 font-bold uppercase tracking-widest text-[9px]">{{ t('history_detail.n_changed_files', { count: changedFiles.length }) }}</div>
        </div>

        <VirtualScroll
            class="flex-1 min-h-0"
            :items="changedFiles"
            :item-height="36"
            v-slot="{ item }"
        >
            <div
                @click="emit('selectFile', item.data.path)"
                class="h-stack gap-3 group cursor-pointer hover:bg-neutral-200/80 dark:hover:bg-neutral-800/80 px-3 rounded transition-colors overflow-hidden"
                style="height: 36px; display: flex; align-items: center;"
                @mouseenter="startMarquee($event, '.truncate')" @mouseleave="stopMarquee($event, '.truncate')"
            >
               <Icon :icon="getStatusIcon(item.data.status)"
                     :class="getStatusColor(item.data.status)"
                     class="text-[14px] shrink-0" />
               <span class="text-[11px] text-neutral-600 dark:text-neutral-400 truncate group-hover:text-blue-400 transition-colors">{{ item.data.path }}</span>
            </div>
        </VirtualScroll>

        <div v-if="!changedFiles.length" class="center p-8 opacity-20 text-[10px] uppercase font-bold tracking-widest text-center">
            {{ t('history_detail.no_files_changed') }}
        </div>
    </div>
  </div>
</template>

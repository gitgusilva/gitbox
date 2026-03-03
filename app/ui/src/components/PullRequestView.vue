<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';
import { activePullRequest } from '../services/modalService';
import { activeTab } from '../services/gitService';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { formatFullDate } from '../utils/formatters';

const { t } = useI18n();

function close() {
    activePullRequest.value = null;
    activeTab.value = 'history';
}

function openExternal(url: string) {
    if (window.gitbox?.openExternal && url) {
        window.gitbox.openExternal(url);
    }
}

function renderMd(text: string) {
    if (!text) return '';
    return DOMPurify.sanitize(marked.parse(text) as string);
}

const pr = computed(() => activePullRequest.value);

</script>

<template>
  <div v-if="pr" class="flex-1 flex flex-col min-w-0 min-h-0 bg-white dark:bg-[#1E1E1E] animate-in fade-in duration-300">
    <!-- Header -->
    <header class="bg-[#252526] border-b border-neutral-800 flex items-center justify-between px-4 py-2 flex-shrink-0">
      <div class="flex items-center gap-2 text-neutral-300 font-medium">
        <Icon icon="mdi:github" class="text-xl" />
        <span class="text-sm">GitHub Pull Request</span>
      </div>
      <div class="flex items-center gap-2">
        <button @click="openExternal(pr.url)" class="text-neutral-400 hover:text-white transition-colors p-1 rounded hover:bg-neutral-800" title="Open in Browser">
          <Icon icon="lucide:external-link" class="text-sm" />
        </button>
        <button @click="close" class="text-neutral-400 hover:text-white hover:bg-red-500 transition-colors p-1 rounded" title="Close">
          <Icon icon="lucide:x" class="text-sm" />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <SimpleBar class="flex-1 overflow-x-hidden p-6 relative">
      <div class="max-w-[1200px] mx-auto w-full flex flex-col gap-6 font-sans">
        
        <!-- PR Title Header -->
        <div class="flex flex-col gap-3 pb-6 border-b border-neutral-800">
           <div class="text-xs text-neutral-500 font-mono">#{{ pr.number }}</div>
           <h1 class="text-2xl text-white font-medium flex items-center gap-3">
             {{ pr.title }}
             <button class="text-neutral-500 hover:text-white p-1 opacity-0 hover:opacity-100 transition-opacity">
               <Icon icon="lucide:edit-2" class="text-sm" />
             </button>
           </h1>
           <div class="flex items-center gap-3 text-sm text-neutral-400">
             <div class="flex items-center gap-1.5 bg-green-900/40 text-green-400 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ring-green-500/50">
                Open
             </div>
             <div class="flex items-center gap-2">
                <img :src="pr.user?.avatar_url" class="w-5 h-5 rounded-full" />
                <span class="font-bold text-neutral-200">{{ pr.user?.login }}</span>
                <span>wants to merge <span class="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-mono text-xs">{{ pr.sourceBranch }}</span> into <span class="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-mono text-xs">{{ pr.targetBranch }}</span></span>
             </div>
           </div>
        </div>

        <!-- 2 Column Layout -->
        <div class="flex flex-col md:flex-row gap-8">
           <!-- Left Column -->
           <div class="flex-1 flex flex-col gap-6 min-w-0">
             
             <!-- Description Area -->
             <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between text-xs font-medium text-neutral-300">
                   Description
                   <button class="text-neutral-500 hover:text-white"><Icon icon="lucide:edit-2" /></button>
                </div>
                <!-- Markdown Content -->
                <div class="bg-[#1E1E1E] text-neutral-300 prose prose-invert prose-sm max-w-none p-4 rounded-lg border border-neutral-800">
                   <div v-if="pr.body" v-html="renderMd(pr.body)"></div>
                   <div v-else class="text-neutral-500 italic">No description provided.</div>
                </div>
             </div>
             
             <!-- Comments Area Placeholder -->
             <div class="flex flex-col gap-4 mt-6">
                <div class="flex items-center justify-between text-xs font-medium text-neutral-300">
                   Comments
                   <button class="text-neutral-500 hover:text-white"><Icon icon="lucide:refresh-cw" /></button>
                </div>
                
                <!-- System Comment (Simulated) -->
                <div class="flex items-start gap-3">
                   <Icon icon="lucide:message-square" class="text-neutral-500 mt-1" />
                   <div class="flex-1 bg-[#252526] rounded-lg border border-neutral-800 overflow-hidden">
                      <div class="bg-neutral-800/50 px-3 py-2 border-b border-neutral-800 text-xs flex items-center justify-between">
                         <div class="flex items-center gap-2">
                             <div class="w-5 h-5 rounded-full bg-neutral-700 flex items-center justify-center relative overflow-hidden">
                                <Icon icon="lucide:bot" class="text-xs text-neutral-400" />
                             </div>
                             <span class="font-medium text-neutral-200">system (gitbox)</span>
                             <span class="text-neutral-500">just now</span>
                         </div>
                         <button class="text-neutral-500 hover:text-white"><Icon icon="lucide:more-vertical" /></button>
                      </div>
                      <div class="p-3 text-sm text-neutral-300">
                         Pull request integration is ready to be expanded! Use the browser for now to submit reviews or edit comments.
                      </div>
                   </div>
                </div>

                <!-- Add Comment Input Box -->
                <div class="flex gap-3 mt-4">
                  <img :src="pr.user?.avatar_url" class="w-8 h-8 rounded-full border border-neutral-700" />
                  <div class="flex-1 bg-[#252526] border border-neutral-700 focus-within:border-blue-500 rounded-lg overflow-hidden transition-colors flex flex-col">
                     <textarea class="w-full bg-transparent border-none outline-none resize-none min-h-[80px] p-3 text-sm text-neutral-200 placeholder:text-neutral-600" placeholder="Add a comment..."></textarea>
                     <div class="bg-[#2D2D2D] border-t border-neutral-800 p-2 flex justify-end gap-2">
                        <button class="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded font-medium text-xs transition-colors">Comment</button>
                     </div>
                  </div>
                </div>

             </div>
             
           </div>

           <!-- Right Column (Sidebar) -->
           <div class="w-[300px] flex-shrink-0 flex flex-col gap-6">
              
              <!-- Review Actions -->
              <div class="flex flex-col gap-2 pb-6 border-b border-neutral-800">
                 <div class="text-xs text-neutral-400 font-medium mb-1">0 files changed <span class="text-neutral-600">(Not fetched)</span></div>
                 <button class="w-full bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 border border-blue-500/50 py-1.5 rounded text-sm transition-colors">Review Code and Suggest Changes</button>
                 <button class="w-full bg-green-900/30 hover:bg-green-800/50 text-green-400 border border-green-500/50 py-1.5 rounded text-sm transition-colors mt-1">Submit a Review</button>
              </div>
              
              <div class="flex flex-col gap-4">
                <!-- Reviewers -->
                <div class="flex flex-col gap-2">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     Reviewers
                     <button class="text-neutral-500 hover:text-white"><Icon icon="lucide:edit-2" class="text-xs" /></button>
                   </div>
                   <div v-if="pr.requestedReviewers?.length" class="flex flex-col gap-2">
                      <div v-for="r in pr.requestedReviewers" :key="r.login" class="flex items-center gap-2 text-sm text-neutral-300">
                         <img :src="r.avatar_url" class="w-5 h-5 rounded-full" />
                         <span>{{ r.login }}</span>
                      </div>
                   </div>
                   <div v-else class="text-xs text-neutral-600 italic">No reviewers</div>
                </div>

                <!-- Assignees -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     Assignees
                     <button class="text-neutral-500 hover:text-white"><Icon icon="lucide:edit-2" class="text-xs" /></button>
                   </div>
                   <div v-if="pr.assignees?.length" class="flex flex-col gap-2">
                      <div v-for="a in pr.assignees" :key="a.login" class="flex items-center gap-2 text-sm text-neutral-300">
                         <img :src="a.avatar_url" class="w-5 h-5 rounded-full" />
                         <span>{{ a.login }}</span>
                      </div>
                   </div>
                   <div v-else class="text-xs text-neutral-600 italic">No one assigned</div>
                </div>

                <!-- Labels -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     Labels
                     <button class="text-neutral-500 hover:text-white"><Icon icon="lucide:edit-2" class="text-xs" /></button>
                   </div>
                   <div v-if="pr.labels?.length" class="flex flex-wrap gap-1.5">
                      <span v-for="l in pr.labels" :key="l.name" 
                            class="px-2 py-0.5 rounded text-[10px] font-medium border"
                            :style="{ backgroundColor: '#' + l.color + '20', borderColor: '#' + l.color + '40', color: '#' + l.color }">
                         {{ l.name }}
                      </span>
                   </div>
                   <div v-else class="text-xs text-neutral-600 italic">None yet</div>
                </div>

                <!-- Participants -->
                <div class="flex flex-col gap-2 mt-4">
                   <div class="flex items-center justify-between text-xs text-neutral-400 font-medium">
                     Participants
                   </div>
                   <div class="flex items-center gap-1">
                      <img :src="pr.user?.avatar_url" class="w-6 h-6 rounded-full border border-neutral-800" :title="pr.user?.login" />
                      <!-- Additional logic could add assignees/reviewers dynamically -->
                   </div>
                </div>

                <!-- Branch -->
                <div class="flex flex-col gap-2 mt-4 border-t border-neutral-800 pt-4">
                   <div class="text-xs text-neutral-400 font-medium">Branch</div>
                   <div class="bg-blue-900/20 text-blue-400 px-2.5 py-1 rounded font-mono text-xs border border-blue-900/50 truncate" :title="pr.sourceBranch">
                     {{ pr.sourceBranch }}
                   </div>
                </div>
              </div>

           </div>
        </div>

      </div>
    </SimpleBar>
  </div>
</template>

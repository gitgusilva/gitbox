<script setup lang="ts">
import { Icon } from '@iconify/vue';
import SimpleBar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

const props = defineProps<{
    version: string;
}>();

const changes = [
    {
        type: 'feature',
        title: 'Central Storage System',
        description: 'Migrated preferences to a resilient electron-store backed implementation to persist settings properly.'
    },
    {
        type: 'feature',
        title: 'Repository and Branch Filtering',
        description: 'New searchable dropdown menus for selecting repositories and branches, complete with scrollbars and badges.'
    },
    {
        type: 'improvement',
        title: 'Commit History Formatting',
        description: 'Commit authors and committers now properly line break, preventing cropped text on smaller windows.'
    },
    {
        type: 'improvement',
        title: 'Commit History Navigation',
        description: 'You can now navigate the commit history list using the up and down arrow keys.'
    },
    {
        type: 'feature',
        title: 'Shortcuts Modal Enhancement',
        description: 'Added a standard close button (X) at the top right of the shortcuts modal for better accessibility.'
    },
    {
        type: 'feature',
        title: 'Changelog Screen',
        description: 'A new changelog screen that shows up on new versions or can be manually triggered from settings.'
    }
];

const getIconForType = (type: string) => {
    switch (type) {
        case 'feature': return 'lucide:star';
        case 'improvement': return 'lucide:zap';
        case 'bugfix': return 'lucide:bug';
        default: return 'lucide:info';
    }
};

const getColorForType = (type: string) => {
    switch (type) {
        case 'feature': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        case 'improvement': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        case 'bugfix': return 'text-red-400 bg-red-500/10 border-red-500/20';
        default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20';
    }
};
</script>

<template>
  <div class="flex-1 flex flex-col bg-[#1E1E1E] overflow-hidden">
    <!-- Header -->
    <div class="p-8 border-b border-neutral-800 bg-[#252526] flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-6">
            <div class="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <Icon icon="lucide:rocket" class="text-3xl text-white animate-bounce-slow" />
            </div>
            <div>
                <div class="text-xs uppercase tracking-[0.2em] font-black text-blue-500 mb-1">Release Notes</div>
                <h1 class="text-3xl font-black text-white">What's New in GitBox</h1>
            </div>
        </div>
        <div class="text-right">
            <div class="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-bold">Current Version</div>
            <span class="text-lg font-mono bg-neutral-800 border border-neutral-700 px-4 py-1.5 rounded-full text-neutral-300">v{{ version }}</span>
        </div>
    </div>

    <!-- Content -->
    <SimpleBar class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto p-12 py-16 flex flex-col gap-12">
            <div v-for="(change, idx) in changes" :key="idx" class="flex gap-8 group">
                <div class="mt-1 flex-shrink-0">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 shadow-lg" :class="getColorForType(change.type)">
                        <Icon :icon="getIconForType(change.type)" class="text-xl" />
                    </div>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border" :class="getColorForType(change.type)">{{ change.type }}</span>
                        <h2 class="text-lg font-bold text-neutral-100">{{ change.title }}</h2>
                    </div>
                    <p class="text-sm text-neutral-400 leading-relaxed max-w-2xl">{{ change.description }}</p>
                    <div class="h-px w-full bg-gradient-to-r from-neutral-800 to-transparent mt-8"></div>
                </div>
            </div>

            <!-- Footer Section in Content -->
            <div class="mt-8 p-8 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex flex-col items-center text-center">
                <Icon icon="lucide:star" class="text-3xl text-blue-500 mb-4" />
                <h3 class="text-xl font-bold text-white mb-2">Thanks for using GitBox!</h3>
                <p class="text-neutral-400 text-sm max-w-md">We're constantly working to make GitBox the best Git client for developers. Stay tuned for more updates soon.</p>
            </div>
        </div>
    </SimpleBar>
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

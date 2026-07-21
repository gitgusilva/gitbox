<script setup lang="ts">
import { asset } from '../asset';
import { ref, onMounted, onBeforeUnmount } from 'vue';

const scrolled = ref(false);
const onScroll = () => { scrolled.value = window.scrollY > 12; };

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
    :class="scrolled ? 'border-b border-line bg-ink/85 backdrop-blur' : 'border-b border-transparent'"
  >
    <nav class="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6">
      <a href="#top" class="flex items-center gap-2.5">
        <img :src="asset('logo.png')" alt="" class="h-7 w-7" />
        <span class="text-sm font-bold tracking-tight text-strong">GitBox</span>
      </a>

      <div class="ml-auto hidden items-center gap-6 sm:flex">
        <a href="#features" class="text-xs font-medium text-muted transition-colors hover:text-strong">Features</a>
        <a href="#screenshots" class="text-xs font-medium text-muted transition-colors hover:text-strong">Screenshots</a>
        <a href="https://github.com/gitgusilva/gitbox" class="text-xs font-medium text-muted transition-colors hover:text-strong">GitHub</a>
      </div>

      <a
        href="#download"
        class="ml-auto rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-soft sm:ml-0"
      >
        Download
      </a>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { asset } from '../asset';
</script>

<template>
  <footer class="border-t border-line">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center">
      <div class="flex items-center gap-2.5">
        <img :src="asset('logo.png')" alt="" class="h-6 w-6" />
        <span class="text-xs font-bold text-strong">GitBox</span>
        <span class="text-xs text-muted">— MIT licensed</span>
      </div>

      <nav class="flex flex-wrap gap-5 sm:ml-auto">
        <a href="https://github.com/gitgusilva/gitbox" class="text-xs text-muted transition-colors hover:text-strong">Source</a>
        <a href="https://github.com/gitgusilva/gitbox/releases" class="text-xs text-muted transition-colors hover:text-strong">Releases</a>
        <a href="https://github.com/gitgusilva/gitbox/issues" class="text-xs text-muted transition-colors hover:text-strong">Issues</a>
        <a href="https://github.com/gitgusilva/gitbox/blob/main/CHANGELOG.md" class="text-xs text-muted transition-colors hover:text-strong">Changelog</a>
      </nav>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { asset } from '../asset';
import { useI18n } from '../i18n';

const { t } = useI18n();
</script>

<template>
  <footer class="border-t border-line">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center">
      <div class="flex items-center gap-2.5">
        <img :src="asset('logo.png')" alt="" class="h-6 w-6" />
        <span class="text-xs font-bold text-strong">GitBox</span>
        <span class="text-xs text-muted">{{ t('footer.license') }}</span>
      </div>

      <nav class="flex flex-wrap gap-5 sm:ml-auto">
        <a href="https://github.com/gitgusilva/gitbox" class="text-xs text-muted transition-colors hover:text-strong">{{ t('footer.source') }}</a>
        <a href="https://github.com/gitgusilva/gitbox/releases" class="text-xs text-muted transition-colors hover:text-strong">{{ t('footer.releases') }}</a>
        <a href="https://github.com/gitgusilva/gitbox/issues" class="text-xs text-muted transition-colors hover:text-strong">{{ t('footer.issues') }}</a>
        <a href="https://github.com/gitgusilva/gitbox/blob/main/CHANGELOG.md" class="text-xs text-muted transition-colors hover:text-strong">{{ t('footer.changelog') }}</a>
      </nav>
    </div>
  </footer>
</template>

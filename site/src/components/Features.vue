<script setup lang="ts">
const features = [
  {
    title: 'Native speed',
    body: 'Git runs through a purpose-built C++ addon on libgit2 — statically linked, no system git required. Repositories with thousands of commits open instantly.',
    icon: '⚡',
  },
  {
    title: 'Visual history',
    body: 'A real commit graph with merge glyphs, tags and branch labels, virtualized so scrolling stays smooth no matter how deep the history goes.',
    icon: '🌳',
  },
  {
    title: 'Projects',
    body: 'Group the repositories you work with into colour-coded projects. Switching context swaps the whole tab bar — one click instead of reopening tabs.',
    icon: '🗂️',
  },
  {
    title: 'Monaco diffs',
    body: 'Side-by-side and inline diffs powered by the editor behind VS Code, with image, markdown and ribbon views for anything that is not plain text.',
    icon: '📄',
  },
  {
    title: 'Conflict editor',
    body: 'Merge conflicts open in a dedicated three-pane editor with per-hunk actions, so you resolve them where you already are.',
    icon: '🔀',
  },
  {
    title: 'Integrated terminal',
    body: 'A full terminal session (xterm.js + node-pty) docked in the workspace for the moments a GUI should get out of your way.',
    icon: '▮',
  },
  {
    title: 'Themeable',
    body: 'Every colour is a design token. Edit a theme in the app or install one from the community registry — the graph palette follows along.',
    icon: '🎨',
  },
  {
    title: 'Keyboard centric',
    body: 'Global shortcuts for tabs, projects, terminal and settings, all listed in a searchable sheet and translated into every supported language.',
    icon: '⌨️',
  },
];
</script>

<template>
  <section id="features" class="section">
    <div class="mb-12 max-w-2xl">
      <p class="eyebrow">Features</p>
      <h2 class="mt-3 text-3xl font-bold tracking-tight text-strong sm:text-4xl">
        Everything you reach for, nothing you don't
      </h2>
      <p class="mt-4 text-sm leading-relaxed text-muted">
        GitBox is built around the operations you run dozens of times a day, and it stays out of the way
        for the ones you don't.
      </p>
    </div>

    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <article v-for="f in features" :key="f.title" class="card reveal">
        <div class="text-xl leading-none">{{ f.icon }}</div>
        <h3 class="mt-4 text-sm font-bold text-strong">{{ f.title }}</h3>
        <p class="mt-2 text-[13px] leading-relaxed text-muted">{{ f.body }}</p>
      </article>
    </div>
  </section>
</template>

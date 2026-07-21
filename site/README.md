# GitBox site

Marketing site for GitBox — Vite + Vue 3 + Tailwind, deployed to GitHub Pages by
`.github/workflows/pages.yml` on every push that touches `site/`.

```bash
npm install
npm run dev      # http://localhost:5173/gitbox/
npm run build    # → dist/
npm run preview
```

## Notes

- **Downloads are live.** `src/composables/useLatestRelease.ts` reads
  `releases/latest` from the GitHub API at runtime, so a new tag updates the
  buttons with no rebuild. The request is a module-level singleton with a 6s
  timeout; on failure the UI falls back to the releases page.
- **Base path.** Pages serves the project site from `/gitbox/`. `SITE_BASE=/`
  when deploying to a custom domain. Files in `public/` must be referenced
  through `src/asset.ts` so they follow the base.
- **Hero animation.** `GraphCanvas.vue` is a dependency-free 2D canvas commit
  graph; it pauses off-screen and renders a single static frame under
  `prefers-reduced-motion`.
- **Screenshots** live in `public/screenshots/` and are captured from a
  synthetic demo repository — never from a real one.

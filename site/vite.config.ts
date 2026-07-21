import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

// Served from https://<user>.github.io/gitbox/ by default; set SITE_BASE=/ when
// deploying to a custom domain (or to preview from the filesystem root).
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: loadEnv(mode, '.', 'SITE_').SITE_BASE || '/gitbox/',
}));

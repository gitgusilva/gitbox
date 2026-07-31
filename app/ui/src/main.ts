import { createApp } from 'vue';
import App from './App.vue';
import MergeWindow from './components/MergeWindow.vue';
import DiffWindow from './components/DiffWindow.vue';
import './style.css';
import i18n from './i18n';

// The renderer bundle serves the main window and every detached one; the mode
// query parameter decides which root gets mounted (see ui/electron/src/windows).
const mode = new URLSearchParams(window.location.search).get('mode') || '';

const ROOTS: Record<string, any> = {
    merge: MergeWindow,
    diff: DiffWindow,
};

const app = createApp(ROOTS[mode] ?? App);
app.use(i18n);
app.mount('#app');

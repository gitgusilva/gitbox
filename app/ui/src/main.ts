import { createApp } from 'vue';
import App from './App.vue';
import MergeWindow from './components/MergeWindow.vue';
import './style.css';
import i18n from './i18n';

const isMergeWindow = new URLSearchParams(window.location.search).get('mode') === 'merge';

const app = createApp(isMergeWindow ? MergeWindow : App);
app.use(i18n);
app.mount('#app');

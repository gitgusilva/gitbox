import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// Enables the scroll-reveal styles; see the `.js .reveal` rules in style.css.
document.documentElement.classList.add('js');

createApp(App).mount('#app');

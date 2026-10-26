import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import App from './App.vue';
import router from '@/app/router';
import ReportingTheme from '@/core/theme/reporting.theme';

import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import '@/core/assets/styles.scss';

// Точка входа, аналог запуска приложения в Java.
// Все библиотеки подключаются к ОДНОМУ экземпляру приложения.
const app = createApp(App);

app.use(PrimeVue, {
    theme: {
        preset: ReportingTheme,
        options: {
            darkModeSelector: '.darken',
        },
    },
});

// Pinia подключена как в примере. Хранилища данных добавим по необходимости.
app.use(createPinia());
app.use(router);
app.mount('#app');

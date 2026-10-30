import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/app/pages/HomePage.vue';
import DrTypePeriodPage from '@/app/pages/DrTypePeriodPage.vue';
import DrTypeEnterprisePage from '@/app/pages/DrTypeEnterprisePage.vue';

// Здесь URL связывается с компонентом страницы.
// Авторизации и проверок прав в проекте нет.
const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomePage,
        },
        {
            path: '/type-periods',
            name: 'type-periods',
            component: DrTypePeriodPage,
        },
        {
            path: '/type-enterprises',
            name: 'type-enterprises',
            component: DrTypeEnterprisePage,
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/',
        },
    ],
});

export default router;

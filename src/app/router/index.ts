import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/app/pages/HomePage.vue';
import IncomingReportsPage from '@/app/pages/IncomingReportsPage.vue';
import ReportDesignerPage from '@/app/pages/ReportDesignerPage.vue';
import DrTypePeriodPage from '@/app/pages/DrTypePeriodPage.vue';
import DrPeriodPage from '@/app/pages/DrPeriodPage.vue';
import DrTypeEnterprisePage from '@/app/pages/DrTypeEnterprisePage.vue';
import DrEnterprisePage from '@/app/pages/DrEnterprisePage.vue';
import DrReferencePage from '@/app/pages/DrReferencePage.vue';
import DrReferenceItemPage from '@/app/pages/DrReferenceItemPage.vue';

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
            path: '/periods',
            name: 'periods',
            component: DrPeriodPage,
        },
        {
            path: '/type-enterprises',
            name: 'type-enterprises',
            component: DrTypeEnterprisePage,
        },
        {
            path: '/enterprises',
            name: 'enterprises',
            component: DrEnterprisePage,
        },
        {
            path: '/references',
            name: 'references',
            component: DrReferencePage,
        },
        {
            path: '/reference-items',
            name: 'reference-items',
            component: DrReferenceItemPage,
        },
        {
            path: '/incoming-reports',
            name: 'incoming-reports',
            component: IncomingReportsPage,
        },
        {
            path: '/incoming-reports/new',
            name: 'incoming-report-new',
            component: ReportDesignerPage,
        },
        {
            path: '/incoming-reports/:id',
            name: 'incoming-report-designer',
            component: ReportDesignerPage,
        },
        {
            path: '/:pathMatch(.*)*',
            redirect: '/',
        },
    ],
});

export default router;

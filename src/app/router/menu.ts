import type { MenuItem } from 'primevue/menuitem';

export const APP_MENU: MenuItem[] = [
    {
        label: 'Справочники',
        icon: 'pi pi-book',
        items: [
            { label: 'Типы периодов', route: '/type-periods' },
            { label: 'Типы предприятий', route: '/type-enterprises' },
        ],
    },
];

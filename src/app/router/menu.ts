import type { MenuItem } from 'primevue/menuitem';

export const APP_MENU: MenuItem[] = [
    { label: 'Входящие отчёты', icon: 'pi pi-table', route: '/incoming-reports' },
    {
        label: 'Справочники',
        icon: 'pi pi-book',
        items: [
            {
                label: 'Периоды',
                icon: 'pi pi-list',
                items: [
                    { label: 'Тип периода', route: '/type-periods' },
                    { label: 'Периоды', route: '/periods' },
                ],
            },
            {
                label: 'Предприятия',
                icon: 'pi pi-list',
                items: [
                    { label: 'Тип предприятия', route: '/type-enterprises' },
                    { label: 'Предприятия', route: '/enterprises' },
                ],
            },
            {
                label: 'Справочники',
                icon: 'pi pi-list',
                items: [
                    { label: 'Справочники', route: '/references' },
                    { label: 'Значения справочников', route: '/reference-items' },
                ],
            },
        ],
    },
];

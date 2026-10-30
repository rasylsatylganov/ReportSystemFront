import type { MenuItem } from 'primevue/menuitem';

export const APP_MENU: MenuItem[] = [
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
                ],
            },
            {
                label: 'Справочники',
                icon: 'pi pi-list',
                items: [
                    { label: 'Справочники', route: '/references' },
                ],
            },
        ],
    },
];

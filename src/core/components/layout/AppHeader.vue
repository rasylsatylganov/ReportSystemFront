<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import Menubar from 'primevue/menubar';
import Button from 'primevue/button';
import { APP_MENU } from '@/app/router/menu';

// ref хранит значение, изменение которого автоматически обновляет интерфейс.
const darkMode = ref(false);

function toggleDarkMode() {
    darkMode.value = !darkMode.value;
    document.documentElement.classList.toggle('darken', darkMode.value);
}
</script>

<template>
    <header class="app-header">
        <Menubar :model="APP_MENU" aria-label="Главное меню">
            <template #start>
                <RouterLink to="/" class="app-brand" aria-label="На главную">
                    <i class="pi pi-chart-bar" aria-hidden="true"></i>
                    <span>Универсальная система отчётности</span>
                </RouterLink>
            </template>

            <!-- Поддерживает будущие пункты меню с полем route. -->
            <template #item="{ item, props, hasSubmenu }">
                <RouterLink
                    v-if="item.route"
                    v-slot="{ href, navigate }"
                    :to="item.route"
                    custom
                >
                    <a :href="href" v-bind="props.action" @click="navigate">
                        <span v-if="item.icon" :class="item.icon" aria-hidden="true"></span>
                        <span>{{ item.label }}</span>
                    </a>
                </RouterLink>
                <a v-else v-bind="props.action">
                    <span v-if="item.icon" :class="item.icon" aria-hidden="true"></span>
                    <span>{{ item.label }}</span>
                    <span v-if="hasSubmenu" class="pi pi-angle-down" aria-hidden="true"></span>
                </a>
            </template>

            <template #end>
                <Button
                    :icon="darkMode ? 'pi pi-sun' : 'pi pi-moon'"
                    :aria-label="darkMode ? 'Включить светлую тему' : 'Включить тёмную тему'"
                    :title="darkMode ? 'Светлая тема' : 'Тёмная тема'"
                    :aria-pressed="darkMode"
                    text
                    rounded
                    @click="toggleDarkMode"
                />
            </template>
        </Menubar>
    </header>
</template>

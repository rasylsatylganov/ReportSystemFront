<script setup lang="ts">
import AppHeader from './AppHeader.vue';
import AppContent from './AppContent.vue';
</script>

<template>
    <div class="app-layout">
        <AppHeader />
        <AppContent>
            <!-- slot — место для содержимого из App.vue. -->
            <slot />
        </AppContent>
    </div>
</template>

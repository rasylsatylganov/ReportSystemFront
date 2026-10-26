<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppTemplate from '@/core/components/layout/AppTemplate.vue';
</script>

<template>
    <AppTemplate>
        <!-- Здесь отображается страница, соответствующая текущему URL. -->
        <RouterView />
    </AppTemplate>
</template>

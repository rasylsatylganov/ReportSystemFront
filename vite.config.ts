import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Настройки запуска и сборки. /api пересылается на Java backend.
export default defineConfig({
    plugins: [vue()],
    css: {
        preprocessorOptions: {
            scss: { api: 'modern' },
        },
    },
    resolve: {
        alias: {
            // @/app/... означает src/app/... (абсолютный путь внутри проекта).
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        host: 'localhost',
        allowedHosts: ['localhost', 'terminal.local'],
        port: 5173,
        strictPort: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
        },
    },
    preview: {
        host: 'localhost',
        port: 4173,
        strictPort: true,
    },
});

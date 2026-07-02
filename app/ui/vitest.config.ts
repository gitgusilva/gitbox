import vue from '@vitejs/plugin-vue'
import path from 'path'

export default {
    plugins: [vue()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./src/__tests__/setup.ts'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        server: {
            deps: {
                inline: ['vue', '@iconify/vue', 'vue-i18n']
            }
        }
    }
}

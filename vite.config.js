import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mockApi } from './dev/mock-api.js'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), ...(mode === 'mock' ? [mockApi()] : [])],
    server: {
      proxy: mode === 'mock' ? {} : { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: true } },
    },
    define: mode === 'demo' ? { __DEMO_BUILD_ID__: JSON.stringify(String(Date.now())) } : {},
    build: { target: 'es2022' },
  }
})

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  // Temporary repeatable demo: each dev-server start or production build gets a new generation.
  define: { __DEMO_BUILD_ID__: JSON.stringify(String(Date.now())) },
})

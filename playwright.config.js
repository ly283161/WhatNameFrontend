import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    timeout: 30000,
  },
})

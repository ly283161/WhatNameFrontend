import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5175',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 1100 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'application', testMatch: '**/application.spec.js', use: { baseURL: 'http://127.0.0.1:5175' } },
    { name: 'stage2', testMatch: '**/stage2.spec.js', use: { baseURL: 'http://127.0.0.1:5175' } },
    { name: 'stage1', testMatch: '**/stage1.spec.js', use: { baseURL: 'http://127.0.0.1:5176' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 5175 --strictPort', url: 'http://127.0.0.1:5175', reuseExistingServer: false, timeout: 30_000 },
    { command: 'npm run dev:mock -- --port 5176 --strictPort', url: 'http://127.0.0.1:5176', reuseExistingServer: false, timeout: 30_000 },
  ],
})

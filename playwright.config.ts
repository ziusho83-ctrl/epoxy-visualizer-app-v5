import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  webServer: process.env.PREVIEW_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178',
    url: 'http://127.0.0.1:5178', reuseExistingServer: true,
  },
  use: { baseURL: process.env.PREVIEW_URL || 'http://127.0.0.1:5178', acceptDownloads: true },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium', launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
})

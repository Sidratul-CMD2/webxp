import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 45_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

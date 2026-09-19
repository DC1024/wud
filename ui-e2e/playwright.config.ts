import { defineConfig, devices } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/screenshots.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: baseUrl,
    // The UI defaults to Simplified Chinese (see ui/src/i18n/index.ts) while this
    // suite asserts English labels/roles, so pre-seed the i18n localStorage key to
    // pin every browser context to English before the app boots.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseUrl,
          localStorage: [{ name: 'wud-lang', value: 'en' }],
        },
      ],
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
  },
  timeout: 60000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';

const hostedBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || null;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: hostedBaseUrl ?? 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: hostedBaseUrl
    ? undefined
    : {
        command: 'npm run preview:e2e',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

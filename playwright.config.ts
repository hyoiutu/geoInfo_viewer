import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './electron/tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'electron',
      use: {}
    }
  ]
});

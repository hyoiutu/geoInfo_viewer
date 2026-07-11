import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { closeElectronApp, launchElectronApp } from './support/electron-app';

let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  const launched = await launchElectronApp();
  app = launched.app;
  window = launched.window;
});

test.afterAll(async () => {
  await closeElectronApp(app);
});

test('アプリを起動すると地図が表示される', async () => {
  await expect(window.getByTestId('map-container')).toBeVisible();
});

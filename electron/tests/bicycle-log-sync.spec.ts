import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { createInitialFixtures, createNewUploadFixture } from './fixtures/activities.js';
import { closeElectronApp, launchElectronApp } from './support/electron-app';

const MOCK_STRAVA_URL = 'http://localhost:4010';
const BACKFILL_COMPLETE_TIMEOUT_MS = 20_000;

let app: ElectronApplication;
let window: Page;

// レイヤーONトグルによる自転車ログの表示状態(sync_state含む)を作るための共通処理。
const enableBicycleLogLayer = async (): Promise<void> => {
  const activitiesResponsePromise = window.waitForResponse(
    (response) => response.url().endsWith('/activities') && response.request().method() === 'GET'
  );
  // Chakra UIのSwitchはgetByRole('checkbox').click({force:true})では実際のReact制御状態が
  // 切り替わらないことがある（test_rules.md参照）。ラベルテキストのクリックで確実にトグルする。
  await window.getByText('自転車ログ', { exact: true }).click();
  await activitiesResponsePromise;
  await window.waitForTimeout(500);
};

test.beforeAll(async () => {
  await fetch(`${MOCK_STRAVA_URL}/__test__/reset`, { method: 'POST' });
  await fetch(`${MOCK_STRAVA_URL}/__test__/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createInitialFixtures())
  });

  const launched = await launchElectronApp();
  app = launched.app;
  window = launched.window;

  const backfillButton = window.getByRole('button', { name: '自転車ログ初期取り込み' });
  await backfillButton.click();
  await expect(backfillButton).toBeEnabled({ timeout: BACKFILL_COMPLETE_TIMEOUT_MS });

  // 自転車ログレイヤーをON→OFFにし、初期状態(3件)を表示済み・sync_state設定済みの状態にしておく。
  await enableBicycleLogLayer();
  await window.getByText('自転車ログ', { exact: true }).click();
});

test.afterAll(async () => {
  await closeElectronApp(app);
});

test('Strava上に新しいアクティビティがアップロードされると、レイヤーOFF→ONでsync()が検出し地図に反映される', async () => {
  await fetch(`${MOCK_STRAVA_URL}/__test__/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([createNewUploadFixture()])
  });

  await enableBicycleLogLayer();

  await expect(window.getByTestId('map-container')).toHaveScreenshot('bicycle-log-sync.png');
});

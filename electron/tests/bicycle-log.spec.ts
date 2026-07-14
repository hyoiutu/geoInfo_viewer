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

// バックフィルと自転車ログの新規アクティビティ取得(sync())は、どちらもcycling_activities・sync_stateテーブルと
// モックStravaサーバーの状態を共有し、互いのデータを壊し合うため直列実行が必須（Issue #8）。
// 1ファイルにまとめ、describe.serial()で「前のテストが失敗したら後続はスキップする」順序保証をかけることで、
// 他の独立したテストファイル（app.spec.ts等）とは並列実行できるようにする。
test.describe
  .serial('自転車ログ表示機能', () => {
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
    });

    test.afterAll(async () => {
      await closeElectronApp(app);
    });

    test('自転車ログ初期取り込みが完了すると、地図上に自転車ログが表示される', async () => {
      const backfillButton = window.getByRole('button', { name: '自転車ログ初期取り込み' });
      await backfillButton.click();
      await expect(backfillButton).toBeDisabled();

      await expect(backfillButton).toBeEnabled({ timeout: BACKFILL_COMPLETE_TIMEOUT_MS });

      await enableBicycleLogLayer();

      await expect(window.getByTestId('map-container')).toHaveScreenshot('bicycle-log-backfill.png');
    });

    test('Strava上に新しいアクティビティがアップロードされると、レイヤーOFF→ONでsync()が検出し地図に反映される', async () => {
      // 前のテストでレイヤーはON状態のまま。一度OFFにしてから新規アクティビティを追加し、
      // 改めてONにすることでOFF→ON遷移時のsync()検出を確実に発火させる。
      await window.getByText('自転車ログ', { exact: true }).click();

      await fetch(`${MOCK_STRAVA_URL}/__test__/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createNewUploadFixture()])
      });

      await enableBicycleLogLayer();

      await expect(window.getByTestId('map-container')).toHaveScreenshot('bicycle-log-sync.png');
    });
  });

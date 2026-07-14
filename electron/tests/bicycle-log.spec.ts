import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { createInitialFixtures, createNewUploadFixture } from './fixtures/activities.js';
import { closeElectronApp, launchElectronApp } from './support/electron-app';
import { toggleLayer } from './support/layer-controls';

const MOCK_STRAVA_URL = 'http://localhost:4010';
const BACKFILL_COMPLETE_TIMEOUT_MS = 20_000;

let app: ElectronApplication;
let window: Page;

// レイヤーONトグルによる自転車ログの表示状態(sync_state含む)を作るための共通処理。
// 左サイドバー廃止(Issue #32)により、レイヤー切り替えダイアログを開いてチェック→実行する必要がある。
const enableBicycleLogLayer = async (): Promise<void> => {
  const activitiesResponsePromise = window.waitForResponse(
    (response) => response.url().endsWith('/activities') && response.request().method() === 'GET'
  );
  await toggleLayer(window, '自転車ログ');
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
      // 設定ダイアログはボタン押下と同時に閉じる（Issue #32）ため、実行中・完了は地図下部の進捗フッターで確認する。
      // E2E環境はレート制限間隔を極小化しておりフィクスチャ件数も少ないため、「取得中」表示はごく短時間しか
      // 存在せずPlaywrightのポーリングで捕捉できないことがある（実際に取りこぼされ失敗する事例を確認済み）。
      // そのため実行中状態の可視化は待たず、最終的な完了表示のみを検証する。
      await window.getByRole('button', { name: '設定' }).click();
      await window.getByRole('button', { name: '自転車ログ初期取り込み' }).click();

      await expect(window.getByText('取得が完了しました')).toBeVisible({ timeout: BACKFILL_COMPLETE_TIMEOUT_MS });
      await window.getByRole('button', { name: '閉じる' }).click();

      await enableBicycleLogLayer();

      await expect(window.getByTestId('map-container')).toHaveScreenshot('bicycle-log-backfill.png');
    });

    test('Strava上に新しいアクティビティがアップロードされると、レイヤーOFF→ONでsync()が検出し地図に反映される', async () => {
      // 前のテストでレイヤーはON状態のまま。一度OFFにしてから新規アクティビティを追加し、
      // 改めてONにすることでOFF→ON遷移時のsync()検出を確実に発火させる。
      await toggleLayer(window, '自転車ログ');

      await fetch(`${MOCK_STRAVA_URL}/__test__/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([createNewUploadFixture()])
      });

      await enableBicycleLogLayer();

      await expect(window.getByTestId('map-container')).toHaveScreenshot('bicycle-log-sync.png');
    });
  });

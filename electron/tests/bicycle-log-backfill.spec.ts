import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { createInitialFixtures } from './fixtures/activities.js';
import { closeElectronApp, launchElectronApp } from './support/electron-app';

const MOCK_STRAVA_URL = 'http://localhost:4010';
const BACKFILL_COMPLETE_TIMEOUT_MS = 20_000;

let app: ElectronApplication;
let window: Page;

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

  // waitForLoadState('networkidle')はクリック直後の一瞬「まだ何もリクエストが飛んでいない」タイミングで
  // 即座に解決してしまい、sync完了前にスクリーンショットを撮ってしまう競合が起きるため使わない。
  // レイヤーON時の最後のAPI呼び出し(GET /activities)のレスポンスを明示的に待つことで、
  // 地図のソースデータが更新されるタイミングを確実に捕捉する。
  const activitiesResponsePromise = window.waitForResponse(
    (response) => response.url().endsWith('/activities') && response.request().method() === 'GET'
  );

  // Chakra UIのSwitchはネイティブのinput(checkbox)を視覚的に隠しているため、
  // checkbox roleへclick({force:true})しても実際にはReactの制御状態(checked)が切り替わらないことがある。
  // Switch.Rootは<label>としてレンダリングされる（隠しinputのforと紐づく）ため、
  // ラベルテキストをクリックしてネイティブのlabel-input連動で確実にトグルする。
  await window.getByText('自転車ログ', { exact: true }).click();
  await activitiesResponsePromise;
  // ソースデータ更新→MapLibreの再描画が反映されるまでの短い猶予。
  await window.waitForTimeout(500);

  await expect(window.getByTestId('map-container')).toHaveScreenshot('bicycle-log-backfill.png');
});

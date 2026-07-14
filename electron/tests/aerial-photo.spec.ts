import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from 'playwright';
import { closeElectronApp, launchElectronApp } from './support/electron-app';
import { toggleLayer } from './support/layer-controls';

const AERIAL_PHOTO_TILE_HOST = 'cyberjapandata.gsi.go.jp';

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

test('航空写真レイヤーをONにすると、地図上に航空写真タイルが表示される', async () => {
  // 実際の国土地理院タイルサーバーへ接続する（モックしない）。
  // クリック直後は「まだタイル要求が飛んでいない一瞬」があるため、
  // クリック前にタイル要求のレスポンスを待つPromiseを仕込んでおく。
  const tileResponsePromise = window.waitForResponse((response) => response.url().includes(AERIAL_PHOTO_TILE_HOST));

  await toggleLayer(window, '航空写真');
  await tileResponsePromise;
  // 最初のタイル以外にも複数タイルの読み込みが続くため、落ち着くまで待つ。
  await window.waitForLoadState('networkidle');

  await expect(window.getByTestId('map-container')).toHaveScreenshot('aerial-photo.png');
});

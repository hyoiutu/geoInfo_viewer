import type { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';

/** launchElectronAppの戻り値 */
export type LaunchedElectronApp = {
  /** 起動したElectronアプリケーションのハンドル */
  app: ElectronApplication;
  /** アプリの最初のウィンドウ */
  window: Page;
};

/**
 * Electronアプリを起動し、最初のウィンドウを返す。
 * argsに'.'を渡すことで、リポジトリルートのpackage.json(main: dist-electron/main/main.js)を
 * エントリポイントとしてElectronに読み込ませる。
 * @returns 起動したアプリとその最初のウィンドウ
 */
export const launchElectronApp = async (): Promise<LaunchedElectronApp> => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
};

/**
 * Electronアプリを終了する
 * @param app launchElectronAppで起動したアプリケーションのハンドル
 */
export const closeElectronApp = async (app: ElectronApplication): Promise<void> => {
  await app.close();
};

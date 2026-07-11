import type { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';

export type LaunchedElectronApp = {
  app: ElectronApplication;
  window: Page;
};

// Electronアプリを起動し、最初のウィンドウを返す。
// argsに'.'を渡すことで、リポジトリルートのpackage.json(main: dist-electron/main/main.js)を
// エントリポイントとしてElectronに読み込ませる。
export const launchElectronApp = async (): Promise<LaunchedElectronApp> => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
};

export const closeElectronApp = async (app: ElectronApplication): Promise<void> => {
  await app.close();
};

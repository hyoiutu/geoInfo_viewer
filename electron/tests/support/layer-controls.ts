import type { Page } from 'playwright';

/**
 * レイヤー切り替えダイアログを開き、指定したレイヤーのチェック状態を切り替えて実行する（Issue #32）。
 * Chakra UIのCheckbox(Switchと同様)はgetByRole('checkbox').click()では、視覚的に隠された
 * input要素の実座標がダイアログ本体の要素と重なりクリックがインターセプトされることがある（test_rules.md参照）。
 * ラベルテキストのクリックで確実にトグルする。
 * @param window 対象のPlaywrightページ
 * @param layerName 切り替えるレイヤーの表示名（例: '自転車ログ'）
 */
export const toggleLayer = async (window: Page, layerName: string): Promise<void> => {
  await window.getByRole('button', { name: 'レイヤー切り替え' }).click();
  await window.getByText(layerName, { exact: true }).click();
  await window.getByRole('button', { name: '実行' }).click();
};

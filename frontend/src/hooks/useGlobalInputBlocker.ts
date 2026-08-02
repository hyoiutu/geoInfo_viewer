import { useEffect } from 'react';

const BLOCKED_EVENT_TYPES = [
  'click',
  'mousedown',
  'mouseup',
  'dblclick',
  'contextmenu',
  'keydown',
  'keyup',
  'keypress'
] as const;

/**
 * isActiveがtrueの間、ページ全体に対するマウスクリック操作・キーボード操作を一切受け付けないようにする。
 * 対象イベントをキャプチャフェーズでwindowに登録しpreventDefault・stopPropagationすることで、
 * ネストしたどの要素（ダイアログの背景クリック・Escapeキーによるダイアログクローズを含む）にも
 * イベントが到達しないようにする。個々のボタン・入力要素をdisabledにする方式では、対応漏れが
 * 発生するたびに個別修正が必要になる（LayerDialogの実行・リセット・閉じるボタンで実際に発生した）ため、
 * 代わりにグローバルな1箇所で全操作を遮断する（Issue #65、PR #110レビュー対応）
 */
export const useGlobalInputBlocker = (isActive: boolean): void => {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const blockEvent = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    for (const eventType of BLOCKED_EVENT_TYPES) {
      window.addEventListener(eventType, blockEvent, { capture: true });
    }

    return () => {
      for (const eventType of BLOCKED_EVENT_TYPES) {
        window.removeEventListener(eventType, blockEvent, { capture: true });
      }
    };
  }, [isActive]);
};

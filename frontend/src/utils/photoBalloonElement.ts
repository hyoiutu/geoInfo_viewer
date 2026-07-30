import { createElement, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { PhotoBalloonClusterBadge } from '../components/PhotoBalloonClusterBadge';
import { PhotoBalloonThumbnail } from '../components/PhotoBalloonThumbnail';

/** 写真吹き出しマーカー用のDOM要素と、そこへ内容をレンダリングしているReact rootの組（startGoalMarkerElement.tsのMarkerElementと同じ形） */
export type PhotoBalloonMarkerElement = {
  /** maplibregl.Markerにそのまま渡せるDOM要素 */
  element: HTMLDivElement;
  /** 内容をレンダリングしているReact root。マーカー削除時にunmount()を呼ぶこと */
  root: Root;
};

/**
 * Reactコンポーネントを、maplibregl.Markerにそのまま渡せるDOM要素として組み立てる
 * （`startGoalMarkerElement.ts`の`createMarkerElement`と同じパターン）。flushSyncで同期的に
 * コミットすることで、Markerへ渡す時点で内容が描画済みであることを保証する
 * @param node レンダリングするReactの内容
 * @returns Markerのelementオプションに渡せるDOM要素と、対応するReact root
 */
const mountMarkerElement = (node: ReactNode): PhotoBalloonMarkerElement => {
  const container = document.createElement('div');
  const root = createRoot(container);
  flushSync(() => root.render(node));
  return { element: container, root };
};

/**
 * 単一写真の吹き出し用のDOM要素・React rootを組み立てる
 * @param photoId 対象の写真ID
 * @param fileName altテキストに使うファイル名
 */
export const createPhotoBalloonThumbnailElement = (photoId: number, fileName: string): PhotoBalloonMarkerElement =>
  mountMarkerElement(createElement(PhotoBalloonThumbnail, { photoId, fileName }));

/**
 * クラスタ（近接する複数写真をまとめたもの）の吹き出し用のDOM要素・React rootを組み立てる
 * @param photoCount クラスタにまとまっている写真の件数
 */
export const createPhotoBalloonClusterElement = (photoCount: number): PhotoBalloonMarkerElement =>
  mountMarkerElement(createElement(PhotoBalloonClusterBadge, { photoCount }));

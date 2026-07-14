import { Flag, Play } from 'lucide-react';
import { createElement, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import {
  GOAL_MARKER_ICON_COLOR,
  START_GOAL_MARKER_ICON_SIZE,
  START_MARKER_ICON_COLOR
} from '../constants/startGoalMarkers';

const MARKER_BACKGROUND_PADDING_PX = 4;

/** マーカー用のDOM要素と、そこへアイコンをレンダリングしているReact rootの組 */
export type MarkerElement = {
  /** maplibregl.Markerにそのまま渡せるDOM要素 */
  element: HTMLDivElement;
  /** アイコンをレンダリングしているReact root。マーカー削除時にunmount()を呼ぶこと */
  root: Root;
};

/**
 * lucide-reactのアイコンを、maplibregl.Markerにそのまま渡せる白背景の丸いDOM要素として組み立てる。
 * MapLibreのMarker APIが生のHTMLElementを要求するためcontainer自体はdocument.createElementで作るが、
 * その中身はReactのcreateRoot経由でレンダリングし、innerHTMLへの文字列注入は行わない。
 * flushSyncで同期的にコミットすることで、Markerへ渡す時点でアイコンが描画済みであることを保証する
 * @param icon 表示するlucide-reactのアイコン要素
 * @returns Markerのelementオプションに渡せるDOM要素と、対応するReact root
 */
const createMarkerElement = (icon: ReactElement): MarkerElement => {
  const container = document.createElement('div');
  container.style.background = 'white';
  container.style.borderRadius = '50%';
  container.style.padding = `${MARKER_BACKGROUND_PADDING_PX}px`;
  container.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
  container.style.display = 'flex';

  const root = createRoot(container);
  flushSync(() => root.render(icon));

  return { element: container, root };
};

/** スタート地点マーカー用のDOM要素・React rootを組み立てる */
export const createStartMarkerElement = (): MarkerElement =>
  createMarkerElement(createElement(Play, { color: START_MARKER_ICON_COLOR, size: START_GOAL_MARKER_ICON_SIZE }));

/** ゴール地点マーカー用のDOM要素・React rootを組み立てる */
export const createGoalMarkerElement = (): MarkerElement =>
  createMarkerElement(createElement(Flag, { color: GOAL_MARKER_ICON_COLOR, size: START_GOAL_MARKER_ICON_SIZE }));

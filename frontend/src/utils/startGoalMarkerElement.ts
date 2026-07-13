import { Flag, Play } from 'lucide-react';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  GOAL_MARKER_ICON_COLOR,
  START_GOAL_MARKER_ICON_SIZE,
  START_MARKER_ICON_COLOR
} from '../constants/startGoalMarkers';

const MARKER_BACKGROUND_PADDING_PX = 4;

/**
 * lucide-reactのアイコンを、maplibregl.Markerにそのまま渡せる白背景の丸いDOM要素として組み立てる
 * @param icon 表示するlucide-reactのアイコン要素
 * @returns Markerのelementオプションに渡せるHTMLDivElement
 */
const createMarkerElement = (icon: ReactElement): HTMLDivElement => {
  const container = document.createElement('div');
  container.style.background = 'white';
  container.style.borderRadius = '50%';
  container.style.padding = `${MARKER_BACKGROUND_PADDING_PX}px`;
  container.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
  container.style.display = 'flex';
  container.innerHTML = renderToStaticMarkup(icon);
  return container;
};

/** スタート地点マーカー用のDOM要素を組み立てる */
export const createStartMarkerElement = (): HTMLDivElement =>
  createMarkerElement(createElement(Play, { color: START_MARKER_ICON_COLOR, size: START_GOAL_MARKER_ICON_SIZE }));

/** ゴール地点マーカー用のDOM要素を組み立てる */
export const createGoalMarkerElement = (): HTMLDivElement =>
  createMarkerElement(createElement(Flag, { color: GOAL_MARKER_ICON_COLOR, size: START_GOAL_MARKER_ICON_SIZE }));

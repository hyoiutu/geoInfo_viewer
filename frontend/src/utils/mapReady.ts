import type maplibregl from 'maplibre-gl';
import type { RefObject } from 'react';

/**
 * mapRef.current・isStyleLoadedの両方を満たした場合のみ地図インスタンスを返す。`frontend/src/hooks/use*.ts`の
 * 各フックが共通で持っていた`if (!map || !isStyleLoaded) { return; }`というガード節を1箇所に集約したもの
 * （PR #128レビュー対応、design_principles.mdのDRY原則）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 * @returns 条件を満たす場合は地図インスタンス、満たさない場合はnull
 */
export const getReadyMap = (mapRef: RefObject<maplibregl.Map | null>, isStyleLoaded: boolean): maplibregl.Map | null =>
  isStyleLoaded ? mapRef.current : null;

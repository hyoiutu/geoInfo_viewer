import type maplibregl from 'maplibre-gl';
import { type RefObject, useEffect, useRef } from 'react';
import type { Photo } from '../api/activitiesApi';
import { applyPhotoBalloons, type PhotoBalloonMarkerEntry } from '../utils/mapLayerInteraction';
import { getReadyMap } from '../utils/mapReady';
import { buildPhotoClusterIndex, type PhotoClusterIndex } from '../utils/photoBalloonCluster.util';

/**
 * 地図上の写真吹き出し表示を管理するフック（Issue #107）。写真一覧が変化するたびにクラスタリング
 * インデックスを再構築して吹き出しを再描画するのに加え、パン・ズーム操作（`moveend`）のたびにも
 * 現在のクラスタインデックスで再計算する（クラスタリング結果は表示範囲・ズームレベルに依存するため）。
 * moveendハンドラの登録・クラスタリングインデックスの再構築は`photoClusterIndexRef`/`photoBalloonMarkersRef`を
 * 共有するため1つのフックにまとめている（Issue #127、MapView.tsxから切り出し）
 * @param mapRef 地図インスタンスへのref（useMapInstanceが返すもの）
 * @param photos フォーカス中のアクティビティの写真一覧
 * @param isStyleLoaded スタイル読み込みが完了したかどうか
 * @param onPhotoClick 写真吹き出しがクリックされたときに、対象の写真IDを渡して呼ばれるコールバック
 */
export const usePhotoBalloons = (
  mapRef: RefObject<maplibregl.Map | null>,
  photos: Photo[],
  isStyleLoaded: boolean,
  onPhotoClick: (photoId: number) => void
): void => {
  const photoBalloonMarkersRef = useRef<PhotoBalloonMarkerEntry[]>([]);
  const photoClusterIndexRef = useRef<PhotoClusterIndex | null>(null);
  // moveendハンドラはマウント時に一度だけ登録するため、最新の値をrefで参照する（クロージャの陳腐化対策）
  const onPhotoClickRef = useRef(onPhotoClick);
  onPhotoClickRef.current = onPhotoClick;

  // 写真吹き出しはクラスタリング結果が表示範囲・ズームレベルに依存するため、パン・ズーム操作の
  // たびに現在のクラスタインデックス（photoClusterIndexRef、写真一覧が変わるたびに再構築される）を
  // 使って再計算する
  useEffect(() => {
    const map = getReadyMap(mapRef, isStyleLoaded);
    if (!map) {
      return;
    }

    map.on('moveend', () => {
      applyPhotoBalloons(map, photoBalloonMarkersRef, photoClusterIndexRef.current, (photoId) =>
        onPhotoClickRef.current(photoId)
      );
    });
  }, [mapRef, isStyleLoaded]);

  // フォーカス中のアクティビティの写真一覧が変化するたびに、クラスタリングインデックスを再構築し、
  // 現在の表示範囲・ズームレベルで写真吹き出しを再描画する。未フォーカス（photosが空配列）になった
  // 場合はクラスタリング結果も0件になり、吹き出しが全て消える
  useEffect(() => {
    const map = getReadyMap(mapRef, isStyleLoaded);
    if (!map) {
      return;
    }

    photoClusterIndexRef.current = buildPhotoClusterIndex(photos);
    applyPhotoBalloons(map, photoBalloonMarkersRef, photoClusterIndexRef.current, (photoId) =>
      onPhotoClickRef.current(photoId)
    );
  }, [mapRef, photos, isStyleLoaded]);
};

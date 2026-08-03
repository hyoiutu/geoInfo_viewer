import { describe, expect, test } from 'vitest';
import type { LayerVisibility } from '../../types/layer';
import { resolveLayerSettingsChange } from '../resolveLayerSettingsChange';

const createVisibility = (overrides: Partial<LayerVisibility>): LayerVisibility => ({
  'osm-poi': true,
  'osm-road': true,
  'osm-building': true,
  'osm-place-name': true,
  'admin-boundary': true,
  'aerial-photo': false,
  'bicycle-log': false,
  ...overrides
});

describe('resolveLayerSettingsChangeに関するテスト（PR #110レビュー対応）', () => {
  test('年代が変わる場合、willChangeEraはtrueになる', () => {
    const result = resolveLayerSettingsChange(createVisibility({}), 'current', createVisibility({}), '2000-10-01');

    expect(result.willChangeEra).toBe(true);
  });

  test('年代が変わらない場合、willChangeEraはfalseになる', () => {
    const result = resolveLayerSettingsChange(createVisibility({}), 'current', createVisibility({}), 'current');

    expect(result.willChangeEra).toBe(false);
  });

  test('自転車ログがOFF→ONになる場合、willSyncCyclingLogはtrueになる', () => {
    const result = resolveLayerSettingsChange(
      createVisibility({ 'bicycle-log': false }),
      'current',
      createVisibility({ 'bicycle-log': true }),
      'current'
    );

    expect(result.willSyncCyclingLog).toBe(true);
  });

  test('自転車ログがON→OFFになる場合、willSyncCyclingLogはfalseになる（同期不要）', () => {
    const result = resolveLayerSettingsChange(
      createVisibility({ 'bicycle-log': true }),
      'current',
      createVisibility({ 'bicycle-log': false }),
      'current'
    );

    expect(result.willSyncCyclingLog).toBe(false);
  });

  test('自転車ログがON→ONのまま変化しない場合、willSyncCyclingLogはfalseになる', () => {
    const result = resolveLayerSettingsChange(
      createVisibility({ 'bicycle-log': true }),
      'current',
      createVisibility({ 'bicycle-log': true }),
      'current'
    );

    expect(result.willSyncCyclingLog).toBe(false);
  });
});

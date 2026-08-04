import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue, useSetAtom } from 'jotai';
import { describe, expect, test } from 'vitest';
import { createDefaultVisibility } from '../../constants/layerDefinitions';
import type { LayerVisibility } from '../../types/layer';
import { MUNICIPALITY_ERA_CURRENT } from '../../types/municipalityEra';
import { applyLayerSettingsAtom, layerVisibilityAtom, municipalityEraAtom } from '../layerSettingsAtom';

const renderWithProvider = () =>
  renderHook(
    () => {
      const visibility = useAtomValue(layerVisibilityAtom);
      const era = useAtomValue(municipalityEraAtom);
      const applyLayerSettings = useSetAtom(applyLayerSettingsAtom);
      return { visibility, era, applyLayerSettings };
    },
    { wrapper: JotaiProvider }
  );

describe('layerSettingsAtomに関するテスト（Issue #125）', () => {
  test('初期状態ではdefaultVisibility・現行の年代である', () => {
    const { result } = renderWithProvider();

    expect(result.current.visibility).toEqual(createDefaultVisibility());
    expect(result.current.era).toBe(MUNICIPALITY_ERA_CURRENT);
  });

  test('applyLayerSettingsAtomを呼ぶと、レイヤー表示状態・年代の両方が更新される', () => {
    const { result } = renderWithProvider();
    const nextVisibility: LayerVisibility = { ...createDefaultVisibility(), 'bicycle-log': true };

    act(() => {
      result.current.applyLayerSettings({ visibility: nextVisibility, era: '2000-10-01' });
    });

    expect(result.current.visibility).toEqual(nextVisibility);
    expect(result.current.era).toBe('2000-10-01');
  });
});

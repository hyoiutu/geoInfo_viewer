import { fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { LayerSidebar } from '../LayerSidebar';

const LAYERS = [
  { id: 'osm-poi' as const, name: 'POI', checked: true },
  { id: 'osm-road' as const, name: '道路', checked: true },
  { id: 'aerial-photo' as const, name: '航空写真', checked: false }
];

describe('LayerSidebarに関するテスト', () => {
  test('レンダリングされたとき、各レイヤー名が表示される', () => {
    const { getByText } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={vi.fn()} />);

    expect(getByText('POI')).toBeInTheDocument();
    expect(getByText('道路')).toBeInTheDocument();
    expect(getByText('航空写真')).toBeInTheDocument();
  });

  test('レンダリングされたとき、checked=trueのレイヤーのトグルはONになっている', () => {
    const { getByRole } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={vi.fn()} />);

    expect(getByRole('checkbox', { name: 'POI' })).toBeChecked();
  });

  test('レンダリングされたとき、checked=falseのレイヤーのトグルはOFFになっている', () => {
    const { getByRole } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={vi.fn()} />);

    expect(getByRole('checkbox', { name: '航空写真' })).not.toBeChecked();
  });

  test('トグルをクリックすると、onToggleLayerが対象のレイヤーIDで呼ばれる', async () => {
    const onToggleLayer = vi.fn();
    const { getByRole } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={onToggleLayer} />);

    fireEvent.click(getByRole('checkbox', { name: '道路' }));

    await waitFor(() => expect(onToggleLayer).toHaveBeenCalledWith('osm-road'));
  });

  test('初期状態では、レイヤー一覧が表示されている', () => {
    const { getByText } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={vi.fn()} />);

    expect(getByText('POI')).toBeVisible();
  });

  test('折りたたみボタンをクリックすると、レイヤー一覧が非表示になる', () => {
    const { getByRole, queryByText } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={vi.fn()} />);

    fireEvent.click(getByRole('button', { name: 'サイドバーを折りたたむ' }));

    expect(queryByText('POI')).not.toBeInTheDocument();
  });

  test('折りたたんだ状態で展開ボタンをクリックすると、レイヤー一覧が再表示される', () => {
    const { getByRole, getByText } = renderWithChakra(<LayerSidebar layers={LAYERS} onToggleLayer={vi.fn()} />);

    fireEvent.click(getByRole('button', { name: 'サイドバーを折りたたむ' }));
    fireEvent.click(getByRole('button', { name: 'サイドバーを展開する' }));

    expect(getByText('POI')).toBeInTheDocument();
  });
});

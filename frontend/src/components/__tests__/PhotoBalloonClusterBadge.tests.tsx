import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PhotoBalloonClusterBadge } from '../PhotoBalloonClusterBadge';

// PhotoBalloonClusterBadgeはmaplibregl.Marker用の独立したReact rootへマウントされChakraProvider配下に
// 含まれないコンポーネントのため、renderWithChakra（ChakraProviderでラップするヘルパー）ではなく
// 素のrenderを使い、実際の実行時環境（ChakraProviderの外）を再現する（PRレビュー対応）
describe('PhotoBalloonClusterBadgeに関するテスト（Issue #107）', () => {
  test('写真の件数を表示する', () => {
    render(<PhotoBalloonClusterBadge photoCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  test('スクリーンリーダー向けに件数を含むaria-labelを持つ', () => {
    render(<PhotoBalloonClusterBadge photoCount={5} />);

    expect(screen.getByLabelText('5件の写真')).toBeInTheDocument();
  });
});

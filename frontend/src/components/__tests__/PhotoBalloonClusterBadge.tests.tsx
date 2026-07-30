import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { PhotoBalloonClusterBadge } from '../PhotoBalloonClusterBadge';

describe('PhotoBalloonClusterBadgeに関するテスト（Issue #107）', () => {
  test('写真の件数を表示する', () => {
    renderWithChakra(<PhotoBalloonClusterBadge photoCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

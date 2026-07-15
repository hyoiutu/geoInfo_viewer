import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { BackfillStatus } from '../../api/activitiesApi';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { BackfillProgressFooter } from '../BackfillProgressFooter';

const RUNNING_STATUS: BackfillStatus = {
  isRunning: true,
  totalCount: 4,
  completedCount: 1,
  progressPercent: 25,
  estimatedRemainingSeconds: 27,
  lastError: null
};

const COMPLETED_STATUS: BackfillStatus = {
  isRunning: false,
  totalCount: 4,
  completedCount: 4,
  progressPercent: 100,
  estimatedRemainingSeconds: null,
  lastError: null
};

describe('BackfillProgressFooterに関するテスト', () => {
  test('isVisibleがfalseの場合、何も表示されない', () => {
    const { container } = renderWithChakra(
      <BackfillProgressFooter isVisible={false} backfillStatus={RUNNING_STATUS} onDismiss={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('backfillStatusがnullの場合、何も表示されない', () => {
    const { container } = renderWithChakra(
      <BackfillProgressFooter isVisible backfillStatus={null} onDismiss={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test('実行中の場合、進捗率・件数・残り時間を表示する', () => {
    renderWithChakra(<BackfillProgressFooter isVisible backfillStatus={RUNNING_STATUS} onDismiss={vi.fn()} />);

    expect(screen.getByText(/25%/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*4/)).toBeInTheDocument();
    expect(screen.getByText(/残り約1分/)).toBeInTheDocument();
  });

  test('実行中の場合、閉じるボタンは表示されない', () => {
    renderWithChakra(<BackfillProgressFooter isVisible backfillStatus={RUNNING_STATUS} onDismiss={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '閉じる' })).not.toBeInTheDocument();
  });

  test('完了後の場合、完了メッセージと閉じるボタンを表示する', () => {
    renderWithChakra(<BackfillProgressFooter isVisible backfillStatus={COMPLETED_STATUS} onDismiss={vi.fn()} />);

    expect(screen.getByText('取得が完了しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
  });

  test('完了後に閉じるボタンを押すと、onDismissが呼ばれる', () => {
    const onDismiss = vi.fn();
    renderWithChakra(<BackfillProgressFooter isVisible backfillStatus={COMPLETED_STATUS} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { ErrorDialog } from '../ErrorDialog';

describe('ErrorDialogに関するテスト', () => {
  test('errorがnullの場合、ダイアログは表示されない', () => {
    renderWithChakra(<ErrorDialog error={null} onClose={vi.fn()} />);

    expect(screen.queryByText('エラーが発生しました')).not.toBeInTheDocument();
  });

  test('errorがある場合、messageとhintを表示する', () => {
    renderWithChakra(
      <ErrorDialog
        error={{
          errorCode: 'STRAVA_API_ERROR',
          message: 'Strava APIとの通信に失敗しました',
          hint: '時間をおいて再試行してください'
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByText('Strava APIとの通信に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('時間をおいて再試行してください')).toBeInTheDocument();
  });

  test('hintがnullの場合、hint部分は表示しない', () => {
    renderWithChakra(
      <ErrorDialog error={{ errorCode: 'INTERNAL_ERROR', message: '予期しないエラー', hint: null }} onClose={vi.fn()} />
    );

    expect(screen.getByText('予期しないエラー')).toBeInTheDocument();
  });

  test('OKボタンを押すとonCloseが呼ばれる', () => {
    const onClose = vi.fn();
    renderWithChakra(
      <ErrorDialog error={{ errorCode: 'INTERNAL_ERROR', message: '予期しないエラー', hint: null }} onClose={onClose} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

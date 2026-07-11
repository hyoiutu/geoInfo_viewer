import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import { ErrorDialog } from '../ErrorDialog';

const ERROR_A = {
  errorCode: 'STRAVA_API_ERROR' as const,
  message: 'Strava APIとの通信に失敗しました',
  hint: '時間をおいて再試行してください'
};
const ERROR_B = { errorCode: 'INTERNAL_ERROR' as const, message: '予期しないエラー', hint: null };

describe('ErrorDialogに関するテスト', () => {
  test('errorsが空の場合、ダイアログは表示されない', () => {
    renderWithChakra(<ErrorDialog errors={[]} onDismiss={vi.fn()} />);

    expect(screen.queryByText('エラーが発生しました')).not.toBeInTheDocument();
  });

  test('errorsが1件の場合、messageとhintを表示し件数表示はしない', () => {
    renderWithChakra(<ErrorDialog errors={[ERROR_A]} onDismiss={vi.fn()} />);

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByText('Strava APIとの通信に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('時間をおいて再試行してください')).toBeInTheDocument();
  });

  test('hintがnullの場合、hint部分は表示しない', () => {
    renderWithChakra(<ErrorDialog errors={[ERROR_B]} onDismiss={vi.fn()} />);

    expect(screen.getByText('予期しないエラー')).toBeInTheDocument();
  });

  test('OKボタンを押すと、現在表示中のエラーのインデックスでonDismissが呼ばれる', () => {
    const onDismiss = vi.fn();
    renderWithChakra(<ErrorDialog errors={[ERROR_A]} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onDismiss).toHaveBeenCalledWith(0);
  });

  test('errorsが複数件の場合、件数(1/2)を表示し前へ/次へで切り替えられる', () => {
    renderWithChakra(<ErrorDialog errors={[ERROR_A, ERROR_B]} onDismiss={vi.fn()} />);

    expect(screen.getByText('エラーが発生しました（1/2）')).toBeInTheDocument();
    expect(screen.getByText('Strava APIとの通信に失敗しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    expect(screen.getByText('エラーが発生しました（2/2）')).toBeInTheDocument();
    expect(screen.getByText('予期しないエラー')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  test('複数件のうち2件目を表示中にOKを押すと、インデックス1でonDismissが呼ばれる', () => {
    const onDismiss = vi.fn();
    renderWithChakra(<ErrorDialog errors={[ERROR_A, ERROR_B]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  test('単一件の場合、前へ/次へボタンは表示しない', () => {
    renderWithChakra(<ErrorDialog errors={[ERROR_A]} onDismiss={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '前へ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument();
  });
});

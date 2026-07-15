import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useHydrateAtoms } from 'jotai/utils';
import { describe, expect, test } from 'vitest';
import { errorsAtom } from '../../atoms/errorsAtom';
import { renderWithChakra } from '../../test-utils/renderWithChakra';
import type { AppErrorInfo } from '../../types/apiError';
import { ErrorDialog } from '../ErrorDialog';

const ERROR_A = {
  errorCode: 'STRAVA_API_ERROR' as const,
  message: 'Strava APIとの通信に失敗しました',
  hint: '時間をおいて再試行してください'
};
const ERROR_B = { errorCode: 'INTERNAL_ERROR' as const, message: '予期しないエラー', hint: null };

/** テストごとに、グローバルなエラースタック（errorsAtom）の初期値を注入するヘルパー */
const Seed = ({ errors }: { errors: AppErrorInfo[] }) => {
  useHydrateAtoms([[errorsAtom, errors]]);
  return null;
};

const renderDialog = (errors: AppErrorInfo[]) =>
  renderWithChakra(
    <>
      <Seed errors={errors} />
      <ErrorDialog />
    </>
  );

describe('ErrorDialogに関するテスト', () => {
  test('errorsが空の場合、ダイアログは表示されない', () => {
    renderDialog([]);

    expect(screen.queryByText('エラーが発生しました')).not.toBeInTheDocument();
  });

  test('errorsが1件の場合、messageとhintを表示し件数表示はしない', () => {
    renderDialog([ERROR_A]);

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByText('Strava APIとの通信に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('時間をおいて再試行してください')).toBeInTheDocument();
  });

  test('hintがnullの場合、hint部分は表示しない', () => {
    renderDialog([ERROR_B]);

    expect(screen.getByText('予期しないエラー')).toBeInTheDocument();
  });

  test('OKボタンを押すと、現在表示中のエラーがスタックから取り除かれダイアログが閉じる', async () => {
    renderDialog([ERROR_A]);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(screen.queryByText('エラーが発生しました')).not.toBeInTheDocument();
    });
  });

  test('errorsが複数件の場合、件数(1/2)を表示し前へ/次へで切り替えられる', () => {
    renderDialog([ERROR_A, ERROR_B]);

    expect(screen.getByText('エラーが発生しました（1/2）')).toBeInTheDocument();
    expect(screen.getByText('Strava APIとの通信に失敗しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    expect(screen.getByText('エラーが発生しました（2/2）')).toBeInTheDocument();
    expect(screen.getByText('予期しないエラー')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  test('複数件のうち2件目を表示中にOKを押すと、2件目がスタックから取り除かれ1件目の表示に戻る', () => {
    renderDialog([ERROR_A, ERROR_B]);
    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByText('Strava APIとの通信に失敗しました')).toBeInTheDocument();
  });

  test('単一件の場合、前へ/次へボタンは表示しない', () => {
    renderDialog([ERROR_A]);

    expect(screen.queryByRole('button', { name: '前へ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument();
  });
});

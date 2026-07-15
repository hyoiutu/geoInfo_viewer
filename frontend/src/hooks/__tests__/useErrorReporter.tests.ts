import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue } from 'jotai';
import { describe, expect, test } from 'vitest';
import { errorsAtom } from '../../atoms/errorsAtom';
import { useErrorReporter } from '../useErrorReporter';

const renderWithProvider = () =>
  renderHook(
    () => {
      const addError = useErrorReporter();
      const errors = useAtomValue(errorsAtom);
      return { addError, errors };
    },
    { wrapper: JotaiProvider }
  );

describe('useErrorReporterに関するテスト', () => {
  test('addErrorを呼ぶと、errorsAtomの配列末尾にエラーが追加される', () => {
    const { result } = renderWithProvider();
    const error = { errorCode: 'INTERNAL_ERROR' as const, message: 'エラー1', hint: null };

    act(() => {
      result.current.addError(error);
    });

    expect(result.current.errors).toEqual([error]);
  });

  test('addErrorを複数回呼ぶと、既存のエラーを上書きせず追加する', () => {
    const { result } = renderWithProvider();
    const errorA = { errorCode: 'INTERNAL_ERROR' as const, message: 'エラーA', hint: null };
    const errorB = { errorCode: 'STRAVA_API_ERROR' as const, message: 'エラーB', hint: null };

    act(() => {
      result.current.addError(errorA);
    });
    act(() => {
      result.current.addError(errorB);
    });

    expect(result.current.errors).toEqual([errorA, errorB]);
  });
});

import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider, useAtomValue, useSetAtom } from 'jotai';
import { describe, expect, test } from 'vitest';
import { addErrorAtom, dismissErrorAtom, errorsAtom } from '../errorsAtom';

const renderWithProvider = () =>
  renderHook(
    () => {
      const errors = useAtomValue(errorsAtom);
      const addError = useSetAtom(addErrorAtom);
      const dismissError = useSetAtom(dismissErrorAtom);
      return { errors, addError, dismissError };
    },
    { wrapper: JotaiProvider }
  );

describe('errorsAtomに関するテスト', () => {
  test('addErrorAtomを呼ぶと、errorsAtomの配列末尾にエラーが追加される', () => {
    const { result } = renderWithProvider();
    const error = { errorCode: 'INTERNAL_ERROR' as const, message: 'エラー1', hint: null };

    act(() => {
      result.current.addError(error);
    });

    expect(result.current.errors).toEqual([error]);
  });

  test('addErrorAtomを複数回呼ぶと、既存のエラーを上書きせず追加する', () => {
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

  test('dismissErrorAtomに指定したindexのエラーが取り除かれる', () => {
    const { result } = renderWithProvider();
    const errorA = { errorCode: 'INTERNAL_ERROR' as const, message: 'エラーA', hint: null };
    const errorB = { errorCode: 'STRAVA_API_ERROR' as const, message: 'エラーB', hint: null };
    act(() => {
      result.current.addError(errorA);
      result.current.addError(errorB);
    });

    act(() => {
      result.current.dismissError(0);
    });

    expect(result.current.errors).toEqual([errorB]);
  });
});

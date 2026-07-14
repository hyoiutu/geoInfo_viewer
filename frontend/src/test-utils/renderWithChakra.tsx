import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { type createStore, Provider as JotaiProvider } from 'jotai';
import type { ReactElement } from 'react';

/**
 * Chakra UIの`ChakraProvider`とJotaiの`Provider`でラップした状態でコンポーネントをレンダリングする、テスト用ヘルパー。
 * Jotaiの`Provider`は呼び出しごとに新しい独立したストアを持つため、テストケース間でグローバルステート（errorsAtom等）が
 * 漏れ出さない
 * @param ui レンダリング対象のReact要素
 * @param options `store`を指定すると、そのストアを使ってレンダリングする（レンダリング前にatomの初期値を注入したい場合に使う）。省略時は呼び出しごとに新しい独立したストアを使う
 * @returns Testing Libraryの`render`の戻り値
 */
export const renderWithChakra = (ui: ReactElement, options?: { store?: ReturnType<typeof createStore> }) =>
  render(ui, {
    wrapper: ({ children }) => (
      <JotaiProvider store={options?.store}>
        <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
      </JotaiProvider>
    )
  });

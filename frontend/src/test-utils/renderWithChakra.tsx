import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import type { ReactElement } from 'react';

/**
 * Chakra UIの`ChakraProvider`とJotaiの`Provider`でラップした状態でコンポーネントをレンダリングする、テスト用ヘルパー。
 * Jotaiの`Provider`は呼び出しごとに新しい独立したストアを持つため、テストケース間でグローバルステート（errorsAtom等）が
 * 漏れ出さない
 * @param ui レンダリング対象のReact要素
 * @returns Testing Libraryの`render`の戻り値
 */
export const renderWithChakra = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <JotaiProvider>
        <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
      </JotaiProvider>
    )
  });

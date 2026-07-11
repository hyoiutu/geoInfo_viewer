import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/**
 * Chakra UIの`ChakraProvider`でラップした状態でコンポーネントをレンダリングする、テスト用ヘルパー
 * @param ui レンダリング対象のReact要素
 * @returns Testing Libraryの`render`の戻り値
 */
export const renderWithChakra = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
  });

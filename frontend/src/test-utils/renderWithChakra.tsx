import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export const renderWithChakra = (ui: ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
  });

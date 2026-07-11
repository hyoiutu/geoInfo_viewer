import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MapWorkspace } from './components/MapWorkspace';

/** アプリのルートコンポーネント。Chakra UIのProviderでMapWorkspaceをラップする */
export const App = () => (
  <ChakraProvider value={defaultSystem}>
    <MapWorkspace />
  </ChakraProvider>
);

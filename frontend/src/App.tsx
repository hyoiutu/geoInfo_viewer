import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MapWorkspace } from './components/MapWorkspace';

export const App = () => (
  <ChakraProvider value={defaultSystem}>
    <MapWorkspace />
  </ChakraProvider>
);

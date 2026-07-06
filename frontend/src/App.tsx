import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MapView } from './components/MapView';

export const App = () => (
  <ChakraProvider value={defaultSystem}>
    <MapView />
  </ChakraProvider>
);

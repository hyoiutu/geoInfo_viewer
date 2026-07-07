import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist'
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.tests.*'],
    setupFiles: ['./src/vitest.setup.ts']
  }
});

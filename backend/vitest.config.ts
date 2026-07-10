import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: false,
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    include: ['src/**/*.tests.ts']
  }
});

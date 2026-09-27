import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});

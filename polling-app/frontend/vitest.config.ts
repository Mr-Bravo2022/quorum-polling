import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Frontend tests render React components in jsdom and run axe-core against the
// output. This is the "accessibility gate" the CI workflow enforces on every PR.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});

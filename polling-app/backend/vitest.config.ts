import { defineConfig } from 'vitest/config';

// Backend unit tests are pure-logic (no DOM), so the Node environment is right.
// Tests live in test/ — outside src/ — so `tsc` (the build) never emits them.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});

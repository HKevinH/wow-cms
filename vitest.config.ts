import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests talk to a real MySQL and are slower than unit tests.
    testTimeout: 15_000,
  },
});

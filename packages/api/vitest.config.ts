import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "tests/setup.ts",
    threads: false, // Miniflare's SQLite DB throws lock errors with concurrency
  },
});

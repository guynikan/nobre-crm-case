import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Makes TEST_DATABASE_URL from .env available to the integration tests.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  test: {
    // Integration tests share one database, so files must not run in parallel.
    fileParallelism: false,
  },
});

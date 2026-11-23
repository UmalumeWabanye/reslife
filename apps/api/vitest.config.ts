import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests share one database, so run files sequentially.
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://students:students@localhost:5432/students_test",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
    },
  },
});

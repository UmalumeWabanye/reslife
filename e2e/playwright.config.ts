import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests across the whole stack. Expects these to be running locally:
 *   docker compose up -d               (Postgres, S3, Mailpit)
 *   pnpm --filter @students/api dev    (http://localhost:4000)
 *   pnpm --filter @students/web dev    (http://localhost:3000)
 *   cd apps/mobile && npx expo start --web   (http://localhost:8081)
 * and a seeded database (pnpm db:seed).
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    // Playwright's bundled Chromium doesn't support every macOS version; use installed Chrome.
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});

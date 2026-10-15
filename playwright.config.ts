import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * The suite runs against a real production build. `SUPPORTFLOW_DB_FILE` is
 * left unset so each server start gets a fresh, deterministically seeded
 * in-memory database — which is what makes tests that mutate tickets safe to
 * run repeatedly.
 *
 * Mutating specs run serially (`workers: 1`) because they share that one
 * database; running them in parallel would have them fight over the same
 * tickets, and a flaky suite is worse than a slow one.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start -- --port 3200",
        url: "http://127.0.0.1:3200/sign-in",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

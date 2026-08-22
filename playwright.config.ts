import { defineConfig, devices } from "@playwright/test";

const publicStorefrontTest = "**/public-storefront.spec.ts";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  globalSetup: "./e2e/fixtures/database.ts",
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-narrow",
      testMatch: publicStorefrontTest,
      use: {
        browserName: "chromium",
        hasTouch: true,
        isMobile: true,
        viewport: { width: 360, height: 740 },
      },
    },
    {
      name: "mobile-webkit",
      testMatch: publicStorefrontTest,
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "pnpm e2e:serve",
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3100",
  },
});

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 30_000 : 10_000,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "https://blob.city",
    trace: "on-first-retry",
  },

  projects: [
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

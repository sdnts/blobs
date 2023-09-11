import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: [
    {
      command: "yarn astro build && yarn astro preview",
      url: "http://localhost:4321",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "yarn api dev",
      cwd: "../../",
      url: "http://localhost:8787",
      reuseExistingServer: !process.env.CI,
    },
  ],
});

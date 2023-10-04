import {
  defineConfig,
  devices,
  type PlaywrightTestProject,
} from "@playwright/test";

const projects: PlaywrightTestProject[] = [
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
];

if (process.env.CI) {
  projects
    .push
    // { name: "firefox", use: { ...devices["Desktop Firefox"] } }
    // { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ();
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 30_000 : 10_000,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },

  projects,

  webServer: [
    {
      command: "yarn ui dev",
      cwd: "../../",
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

import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: process.env.CI ? 60000 : 180000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    launchOptions: { timeout: 120000 },
    ...(process.env.PLAYWRIGHT_CHROME ? { channel: "chrome" } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node apps/api/dist/main.js",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
      cwd: "..",
    },
    {
      command: "npm run dev:web",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      cwd: "..",
    },
  ],
});

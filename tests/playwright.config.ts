import { defineConfig, devices } from "@playwright/test";
const apiPort = process.env.E2E_API_PORT ?? "3000";
const webPort = process.env.E2E_WEB_PORT ?? "5173";
export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: process.env.CI ? 60000 : 180000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    baseURL: `http://localhost:${webPort}`,
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
      url: `http://localhost:${apiPort}/health`,
      env: { PORT: apiPort, FRONTEND_URL: `http://localhost:${webPort}` },
      reuseExistingServer: false,
      cwd: "..",
    },
    {
      command: `npm run dev -w apps/web -- --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      env: { VITE_API_URL: `http://localhost:${apiPort}` },
      reuseExistingServer: false,
      cwd: "..",
    },
  ],
});

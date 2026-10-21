import { defineConfig, devices } from "@playwright/test";
const deployedURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: deployedURL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: deployedURL
    ? undefined
    : {
        command: "npm run preview -- --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    {
      name: "android-chromium",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]) {
  delete process.env[key];
}
process.env.NO_PROXY = "*";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: isCI ? 2 : undefined,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm exec tsx src/index.ts",
      cwd: "apps/server",
      url: "http://127.0.0.1:8787/api/session",
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
      cwd: "apps/web",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        PAGEVIEW_API_TARGET: "http://127.0.0.1:8787",
      },
    },
  ],
});

import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  workers: 1,
  reporter: "list",
  webServer: {
    command: "npm run build && node test/browser-server.js",
    url: "http://127.0.0.1:3197/admin",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:3197",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: { channel: process.env.PW_CHANNEL || "chrome" },
  },
});

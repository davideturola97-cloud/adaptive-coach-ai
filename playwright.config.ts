import { defineConfig, devices } from "@playwright/test";

/**
 * Test end-to-end sull'app compilata, in modalità dimostrativa (nessun dato reale, nessuna chiave):
 * le variabili vuote impediscono a Next.js di leggere .env.local.
 * Tre schermi: Android (Pixel 7), iPhone 14 e computer. Tutti con Chromium; su iPhone si simula schermo e user agent.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "android", use: { ...devices["Pixel 7"] } },
    { name: "iphone", use: { ...devices["iPhone 14"], browserName: "chromium", defaultBrowserType: "chromium" } },
    { name: "computer", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/offline`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      OPENAI_API_KEY: "",
    },
  },
});

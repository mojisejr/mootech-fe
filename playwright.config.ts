import { defineConfig, devices } from "@playwright/test";

/**
 * Auth E2E smoke harness (#mootech-auth-e2e-smoke).
 *
 * Local-only by design: this drives the real local full-stack
 * (FE next dev :3000 -> BE :4000 -> dev Supabase). We deliberately do NOT
 * configure `webServer` — the operator/Oracle starts the stack manually per
 * the Browser Truth doctrine. See e2e/README.md.
 *
 * Specs live under e2e/ as *.spec.ts so the CI `scripts/*.test.ts` tsx loop
 * never picks them up. Run with: npm run test:e2e:auth
 */
export default defineConfig({
  testDir: "./e2e",
  // The app tsconfig uses moduleResolution "bundler". Playwright 1.61's transform
  // throws `context.conditions?.includes is not a function` when resolving
  // cross-file relative imports under that setting, and the per-suite `tsconfig`
  // option does not override it. Workaround: specs are self-contained (they only
  // import from `@playwright/test`, a node_modules package that resolves fine).
  // The e2e/tsconfig.json below exists only for editor/type support.
  tsconfig: "./e2e/tsconfig.json",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    // Default :3000 (the doctrine port); override with E2E_BASE_URL to run against a
    // branch dev server on another port without touching a shared :3000 (#246).
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

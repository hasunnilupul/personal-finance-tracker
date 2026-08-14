import { defineConfig } from "vitest/config";

/**
 * Test setup.
 *
 * `resolve.tsconfigPaths` teaches Vitest the `@/*` alias, so tests import
 * modules by exactly the same specifier the app does — a test that had to reach
 * for `../../lib/...` would drift the moment a file moved. Vite resolves this
 * natively, so it needs no plugin.
 *
 * The `node` environment, not `jsdom`: what is worth testing here is the domain
 * logic — permissions, space scoping, currency conversion, date arithmetic —
 * none of which needs a DOM. Adding one would cost start-up time on every run
 * to serve nothing.
 *
 * Nothing here touches the database. Repositories are mocked at the module
 * boundary, so `pnpm test` runs offline, in CI, and against no shared state
 * that another run could disturb.
 *
 * `.mts` because the config is ESM and the package is not — Vite loads a `.ts`
 * config as CommonJS and warns.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    env: {
      // `lib/db` builds its client at import time, and a service pulled into a
      // test drags it in transitively even when every repository is mocked.
      // This placeholder only has to parse — nothing should ever query it. A
      // test that reaches a real query fails loudly with a connection error,
      // which is exactly the signal wanted: it means a repository was left
      // unmocked, not that the database is missing.
      DATABASE_URL: "postgres://unused:unused@localhost:5432/unused",
    },
  },
});

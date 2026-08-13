import { defineConfig } from 'vitest/config'
import { transform } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// vitest as the repo's real test framework (issue #210). Scoped deliberately narrow:
//   • environment jsdom — needed for React hooks (@testing-library/react renderHook).
//   • include lists ONLY the specs migrated to vitest. The other 71 scripts/*.test.ts are plain
//     node:assert scripts that still run under `tsx` in ci.yml (issue #210: don't move them — they
//     migrate opportunistically). A directory glob would wrongly try to run those as vitest suites,
//     so new vitest specs are added to this list one by one as they convert.
//     (A `.test.tsx` spec is invisible to that ci.yml lane by extension — it globs `*.test.ts`.)
//   • alias '@' → repo root, mirroring tsconfig.json paths ("@/*": ["./*"]).

// JSX (issue #215). tsconfig.json sets jsx: "preserve" because Next compiles JSX itself — and vite
// honours the file's tsconfig, so the first spec that RENDERS a component died with "content
// contains invalid JS syntax" pointing at a perfectly good <Component />. Neither `esbuild.jsx` nor
// `esbuild.tsconfigRaw` overrides it: the discovered tsconfig wins for .ts/.tsx.
// So the transform is done explicitly, `enforce: 'pre'` (before vite's own esbuild and before
// import-analysis). tsconfig.json is left alone — it belongs to the Next build and must keep
// preserve. The alternative was adding @vitejs/plugin-react as a devDependency for one config line;
// this keeps the dependency list unchanged. esbuild is vite's own transitive dep, and if it ever
// stopped resolving here the failure is LOUD (config fails to load) rather than a silently skipped
// transform — swap in the plugin at that point.
const jsxAutomatic = {
  name: 'first-run-jsx-automatic',
  enforce: 'pre' as const,
  async transform(code: string, id: string) {
    const file = id.split('?')[0]
    if (!file.endsWith('.tsx') || file.includes('node_modules')) return null
    const out = await transform(code, {
      loader: 'tsx',
      jsx: 'automatic',
      sourcefile: file,
      sourcemap: true,
      target: 'es2020',
    })
    return { code: out.code, map: out.map }
  },
}

export default defineConfig({
  plugins: [jsxAutomatic],
  test: {
    environment: 'jsdom',
    // ⚠️ UNION, never "pick a side". This list is a pass/fail condition: #214 and #218 each appended
    // one spec to the same line from the same base, so the fastest resolution (keep one branch's
    // line) SILENTLY DELETES the other spec — and ci.yml's tsx lane already skips both by name
    // ("vitest owns them"), so the dropped one would run in NEITHER lane and CI would stay green.
    // Same shape as the merge-conflict rule already written into design-verify.yml. Debt #212 is
    // that this list and ci.yml's skip list are two hand-synced copies of the same fact.
    include: [
      'scripts/logout-clears-caches.test.ts',
      'scripts/v2-tier.test.ts', // #214 — must survive this merge
      'scripts/first-run-screens.test.tsx', // #218
      'scripts/first-run-feedback.test.tsx', // #240 — save feedback + element dead-end (.tsx, vitest)
      'scripts/first-run-reset.test.tsx', // #249 — TEMPORARY, removed together with the route by #248
      'scripts/first-run-reset-ui.test.tsx', // #249 — TEMPORARY, the UI half; removed by #248 too
      'scripts/first-run-source-hook.test.tsx', // #244 — teeth on the hook that DECIDES the status
      'scripts/preview-gate.test.tsx', // #220 — .tsx so ci.yml's `*.test.ts` tsx lane never sees it (no skip-list edit, no #212 sync)
      'scripts/tier-prod-pages.test.tsx', // #225 — page-wiring teeth; .tsx (same reason: invisible to ci.yml tsx lane)
      'scripts/consent-header.test.tsx', // #16 companion — BFF sends x-consent-secret; .tsx (invisible to ci.yml tsx lane)
      'scripts/v2-auth-gate-escape.test.tsx', // #246 — identity-limbo escape hatch; .tsx (vitest-only, no #212 sync)
      'scripts/member-with-friend-limit.test.tsx', // #262 — real free friend limit 1→20; .tsx (invisible to ci.yml tsx lane)
      'scripts/user-friend-limit.test.tsx', // #262 r2 — /api/user limit_friend (FE-button read-path); .tsx (ตู๋ req-changes)
      'scripts/call-api-with-status.test.tsx', // #263 — status-aware fetch path + callApi-unchanged guard; .tsx
      'scripts/compat-calc-error-reasons.test.tsx', // #263 — calculateCompatibility failure-reason classification; .tsx
      'scripts/compat-error-copy-ui.test.tsx', // #263 — the UI half: four causes → four different sentences; .tsx
      'scripts/quota-route.test.tsx', // #264 — /api/quota both-quota remaining + wiring; .tsx
      'scripts/quota-indicator-ui.test.tsx', // #264 — the UI half: what is shown when there IS no number; .tsx
    ],
  },
  resolve: {
    alias: { '@': rootDir },
  },
})

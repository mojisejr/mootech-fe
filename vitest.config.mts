import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// vitest as the repo's real test framework (issue #210). Scoped deliberately narrow:
//   • environment jsdom — needed for React hooks (@testing-library/react renderHook).
//   • include lists ONLY the specs migrated to vitest. The other 71 scripts/*.test.ts are plain
//     node:assert scripts that still run under `tsx` in ci.yml (issue #210: don't move them — they
//     migrate opportunistically). A directory glob would wrongly try to run those as vitest suites,
//     so new vitest specs are added to this list one by one as they convert.
//   • alias '@' → repo root, mirroring tsconfig.json paths ("@/*": ["./*"]).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['scripts/logout-clears-caches.test.ts'],
  },
  resolve: {
    alias: { '@': rootDir },
  },
})

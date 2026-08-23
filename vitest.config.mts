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
      'scripts/calc-cooldown.test.tsx', // #265 — cooldown state machine; every guarantee lives in THIS lane; .tsx
      'scripts/edit-friend-ui.test.tsx', // #266 — edit-friend UI; refuses to open a blank form; .tsx
      'scripts/add-friend-copy.test.tsx', // #277 — ทุกคำในชีทเพิ่มเพื่อนบอกว่าเป็นข้อมูลของเพื่อน + ข้อความล้มที่ถูกอยู่แล้วต้องไม่โดนลบ
      'scripts/pwa-capability.test.tsx', // #285 — PWA capability tri-state (unknown≠false); .tsx (vitest-only)
      'scripts/reminder-logic.test.tsx', // #287 — reminder time/plan/adapter/identity (pure); .tsx
      'scripts/reminders-client.test.tsx', // #287 — transport mapping + useReminders + past-guard; .tsx
      'scripts/reminders-auth-gates.test.tsx', // #287 — SERVER gate teeth: identity/membership/scope (ตู๋ #291 B1); .tsx
      'scripts/notify-state-ui.test.tsx', // #286 — 6 สถานะแจ้งเตือน + negative control ของเคส unknown; .tsx
      'scripts/push-subscribe-wire.test.tsx', // #298 — subscription→POST/DELETE transport + tick-mirrors-server orchestration; .tsx
      'scripts/yam-times-tier-gate.test.tsx', // #316 — ปุ่มเพิ่มปฏิทินรายยามเป็นของสมาชิก + remindersLocked fail-closed; .tsx
      'scripts/push-payload.test.ts', // #288 — notification payload carries ชื่อยาม+เวลา + deep-link
      'scripts/push-authorize.test.ts', // #288 — cron secret gate, fail-closed (truly-absent probe)
      'scripts/push-send.test.ts', // #288 — web-push wrapper: 404/410→gone vs 429/5xx→transient + arg-mapping
      'scripts/push-run.test.ts', // #288 — orchestrator: dedup / 15m ceiling / gone-delete / transient-keep
      'scripts/push-concurrency.test.ts', // #288 — REAL pg: FOR UPDATE SKIP LOCKED, two claimers at once (gated by TEST_DATABASE_URL)
      'scripts/pre-push-lane2.test.ts', // #334 — ฟันของ tsx lane เอง: ต้องอยู่ที่นี่ ไม่ใช่ในเลนที่มันเฝ้า (ตู๋ M1)
      'scripts/guard-test-env-isolation.test.ts', // #337 — sandbox spec ต้องไม่เขียนลง repo จริงตอนรันใต้ hook
      'scripts/coming-soon-toast.test.tsx', // #323 — อายุของ toast เป็นของ store โมดูล ไม่ใช่ของปุ่ม; .tsx
      'scripts/day-cta-tier-gate.test.tsx', // #326 — CTA แถบล่างเป็นสถานะล็อกสำหรับ free + ฟันชั้นผู้เรียก; .tsx
      'scripts/save-sheet-state.test.tsx', // #342 — ชีทอ่าน draft.state: กำลังบันทึก/ล้ม; .tsx
      'scripts/reminder-cta.test.tsx', // #341 — ยาม 3 สถานะ + ปุ่มแถบล่าง 7 สถานะ (pure) + open preselect/addedYamIdsFor; .tsx
      'scripts/resolve-user.test.tsx', // #353 — teeth for lib/v2/resolve-user.ts (identity home) + first-run-reset parity
      'scripts/member-subscription.test.ts', // #354 — pure: deterministic row-select + v2→legacy→free fallback
      'scripts/member-subscription-db.test.ts', // #354 — real pg (skipIf !TEST_DATABASE_URL): migration/parity/determinism/fallback
      'scripts/payment-catalog.test.ts', // #355 — pure: server pricing (satang/VAT-backward) + tier allow-list fail-loud
      'scripts/payment-provision.test.ts', // #355 — pure: expire date math + shadow GREATEST merge (days never burn)
      'scripts/payment-webhook-verify.test.ts', // #355 — pure: Omise HMAC verify, fail-closed (main-lane money gate)
      'scripts/payment-charge-route.test.ts', // #355 — route: session gate + client-ignored + fail-loud-before-charge
      'scripts/payment-webhook-db.test.ts', // #355 — real pg (skipIf !TEST_DATABASE_URL): webhook→settle→provision, idempotent+concurrent
      'scripts/reconcile-cron-db.test.ts', // #360 — real pg: reconciler cron (parallel runs · secret gate · boundary)
      'scripts/discount-rules.test.ts', // #361 — pure: discount math (floor/cap/clamp/VAT/no-100%) + code applicability
      'scripts/discount-concurrency-db.test.ts', // #361 — real pg (skipIf !TEST_DATABASE_URL): quota gate under parallel load + release
      'scripts/discount-preview-db.test.ts', // #361 real pg: preview-charge quote contract + legacy-code answers
      'scripts/ops-packages.test.ts', // #377 — pure: what /ops may change (price + on-sale only)
      'scripts/package-tier-db.test.ts', // #377 — real pg (skipIf !TEST_DATABASE_URL): tier/NOT NULL trap + ops-edit→sale-lane loop
      'scripts/shop-package-mapping.test.ts', // #359 — shop plan→package_code mapping + catalog agreement
      'scripts/upgrade-cta-destinations.test.tsx', // #359 — ทั้ง 4 CTA ชี้มา /v2/shop · ของที่เหลือห้ามชี้มา
      'scripts/onboarding-identity.test.tsx', // #252 — consent identity is server-derived; the body's user_id is inert
      'scripts/save-onboarding-client.test.tsx', // #252 — the client sends the goal and no identity, ever
      'scripts/calendar-month-identity.test.tsx', // #391 — the paid-month gate judges the SESSION (runs with the gate CLOSED)
      'scripts/day-detail-paywall.test.tsx', // #226 — paid sections cut server-side (allow-list) + the cached path
      'scripts/calendar-month-gate-closed.test.tsx', // #293 — the REAL gate constant (never mocked): free refused with 0 upstream calls
      'scripts/home-profile.test.ts', // #383 — MIGRATED off the dead tsx lane (#367)
      'scripts/user-membership-route.test.ts', // #383 — /api/user gains `membership`
      'scripts/user-membership-db.test.ts', // #383 — real pg (skipIf !TEST_DATABASE_URL)
      'scripts/env-example-drift.test.ts', // #403 — .env.example ต้องประกาศทุก env ที่แอปอ่าน (lib/pages/features)
      'scripts/header-tier-badge.test.tsx', // #384 — 5 badge states + the "unknown" case + the 6-screen wiring
      'scripts/discount-code-field.test.tsx', // #363 — โค้ดส่วนลด 3 สถานะ + จอต้องคิดเลขไม่เป็น
      'scripts/charge-status.test.ts', // #363 — หาแถวด้วย chargeId + รอไม่ใช่สำเร็จ + ปักว่า query ห้ามมี limit
      'scripts/order-summary.test.tsx', // #363 — การ์ดสรุปยอด: พิมพ์ quote ไม่คิดเลข + audit คำสัญญารายบรรทัด
      'scripts/payment-method-picker.test.tsx', // #363 — ขายสองวิธี · อีกสองตัวต้องไม่อยู่ใน DOM
      'scripts/qr-screen.test.tsx', // #363 — จอ QR: ห้ามอ้างสำเร็จ/หมดอายุ · ย้อนกลับต้องไม่ยิงอะไร
      'scripts/result-state.test.ts', // #363 — audit 6 สถานะหลังจ่าย: สถานะไหน 'เงินขยับแล้ว' + กดซ้ำช่วยไหม
      'scripts/result-screen.test.tsx', // #363 — จอ result: เครื่องหมายถูกมาจาก paid ไม่ใช่ชื่อสถานะ
      'scripts/use-checkout.test.tsx', // #363 — ✕ ต้องยิง preview ใหม่ · โค้ดผิดห้ามลบราคาทิ้ง
      'scripts/omise-token.test.ts', // #363 — คีย์ v2 เท่านั้น และตั้งทันทีก่อน createToken
      'scripts/v1-add-friend-copy.test.tsx', // #413 — โมดัลเพิ่มเพื่อนของ v1: ป้ายต้องบอกว่าเป็นข้อมูลเพื่อน
    ],
  },
  resolve: {
    alias: { '@': rootDir },
  },
})

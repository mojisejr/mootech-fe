// Deterministic tests for the personalized chat greeting (#mootech-chat-mobile-ux, Phase 3).
// Run: npx tsx scripts/chat-greeting.test.ts
import assert from "node:assert/strict"
import { buildGreeting } from "../components/chat/chat-greeting"

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

const at = (hour: number) => new Date(2026, 5, 28, hour, 0, 0)

// ── name personalization ──
t("includes the user's name when present", () => {
  const g = buildGreeting({ name: "พิมพ์", isReturning: false, now: at(8) })
  assert.ok(g.line1.includes("คุณพิมพ์"), g.line1)
})

t("trims whitespace-only name to the no-name fallback", () => {
  const g = buildGreeting({ name: "   ", isReturning: false, now: at(8) })
  assert.ok(!g.line1.includes("คุณ"), g.line1)
})

t("handles null name (session hydrating) gracefully", () => {
  const g = buildGreeting({ name: null, isReturning: false, now: at(8) })
  assert.ok(g.line1.length > 0 && g.line2.length > 0)
  assert.ok(!g.line1.includes("คุณ"))
})

// ── time buckets ──
t("morning -> อรุณสวัสดิ์", () => assert.ok(buildGreeting({ isReturning: false, now: at(8) }).line1.includes("อรุณสวัสดิ์")))
t("midday -> กลางวัน", () => assert.ok(buildGreeting({ isReturning: false, now: at(12) }).line1.includes("กลางวัน")))
t("afternoon -> บ่าย", () => assert.ok(buildGreeting({ isReturning: false, now: at(16) }).line1.includes("บ่าย")))
t("evening -> เย็น", () => assert.ok(buildGreeting({ isReturning: false, now: at(20) }).line1.includes("เย็น")))
t("late night -> ดึกแล้ว", () => assert.ok(buildGreeting({ isReturning: false, now: at(23) }).line1.includes("ดึกแล้ว")))

// ── returning vs first-time ──
t("first-time line2 introduces มูเมท", () => {
  assert.ok(buildGreeting({ name: "พิมพ์", isReturning: false, now: at(8) }).line2.includes("ซินแสประจำตัว"))
})
t("returning line2 welcomes back", () => {
  assert.ok(buildGreeting({ name: "พิมพ์", isReturning: true, now: at(8) }).line2.includes("ยินดีที่ได้เจอกันอีก"))
})

// ── vow: never leak the jargon word "ปาจื่อ" ──
t("never contains the word ปาจื่อ in any combination", () => {
  for (const isReturning of [true, false]) {
    for (const name of ["พิมพ์", "", null]) {
      for (const h of [8, 12, 16, 20, 23]) {
        const g = buildGreeting({ name, isReturning, now: at(h) })
        assert.ok(!g.line1.includes("ปาจื่อ") && !g.line2.includes("ปาจื่อ"), `leaked at ${name}/${isReturning}/${h}`)
      }
    }
  }
})

console.log(`\nchat-greeting: ${pass} passed`)

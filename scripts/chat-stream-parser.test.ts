// Deterministic unit tests for the chat SSE parser (#mootech-chat-mobile-ux, Phase 2 hard gate).
// DB-free, network-free. Run: npx tsx scripts/chat-stream-parser.test.ts
import assert from "node:assert/strict"
import { parseSseBuffer } from "../lib/chat/use-bazi-chat-stream"

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

const frame = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

// ── delta extraction ──
t("extracts a single delta token", () => {
  const r = parseSseBuffer(frame("สวัสดี"))
  assert.deepEqual(r.tokens, ["สวัสดี"])
  assert.equal(r.done, false)
  assert.equal(r.remainder, "")
})

t("extracts multiple delta tokens in order", () => {
  const r = parseSseBuffer(frame("ดวง") + frame("คุณ") + frame("ดี"))
  assert.deepEqual(r.tokens, ["ดวง", "คุณ", "ดี"])
})

// ── [DONE] sentinel ──
t("detects [DONE] and stops", () => {
  const r = parseSseBuffer(frame("จบ") + "data: [DONE]\n\n")
  assert.deepEqual(r.tokens, ["จบ"])
  assert.equal(r.done, true)
})

t("ignores tokens after [DONE]", () => {
  const r = parseSseBuffer("data: [DONE]\n\n" + frame("ไม่ควรเห็น"))
  assert.equal(r.done, true)
  assert.deepEqual(r.tokens, [])
})

// ── buffering / partial frames ──
t("keeps an incomplete trailing frame as remainder", () => {
  const r = parseSseBuffer(frame("ครบ") + 'data: {"choices":[{"delta":{"content":"ค้าง')
  assert.deepEqual(r.tokens, ["ครบ"])
  assert.equal(r.done, false)
  assert.ok(r.remainder.startsWith("data:"))
})

t("re-parsing remainder + next chunk recovers the split token", () => {
  const first = parseSseBuffer('data: {"choices":[{"delta":{"content":"แบ่ง')
  assert.deepEqual(first.tokens, [])
  const second = parseSseBuffer(first.remainder + 'ครึ่ง"}}]}\n\n')
  assert.deepEqual(second.tokens, ["แบ่งครึ่ง"])
})

// ── robustness ──
t("ignores keep-alive / non-JSON data lines", () => {
  const r = parseSseBuffer("data: \n\n" + "data: : ping\n\n" + frame("จริง"))
  assert.deepEqual(r.tokens, ["จริง"])
})

t("ignores frames with no string content", () => {
  const r = parseSseBuffer('data: {"choices":[{"delta":{}}]}\n\n' + frame("ok"))
  assert.deepEqual(r.tokens, ["ok"])
})

t("empty buffer yields nothing", () => {
  const r = parseSseBuffer("")
  assert.deepEqual(r.tokens, [])
  assert.equal(r.done, false)
})

console.log(`\nchat-stream-parser: ${pass} passed`)

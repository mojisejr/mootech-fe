// mojisejr/mootech-fe#358 Phase 4 — THE SPAN GATE STANDS ALONE. No flag in front of it.
//
// This file replaces scripts/calendar-month-gate-open-scope.test.tsx, whose whole subject was
// `CALENDAR_MONTH_GATE_OPEN`. That switch is gone (lib/v2-calendar/gate.ts deleted), so two of its four
// cases — the ones that flipped it — no longer have a subject. Its other two cases live on unchanged in
// scripts/calendar-month-gate-closed.test.tsx:91 (①, refused beyond span) and :101 (①b, served the month
// they do have), which is why they are not copied here: two files asserting one thing is the seam Phase 2
// existed to close.
//
// 🔴 WHAT THIS FILE IS FOR, and it is not the behaviour. The behaviour was already pinned. What was never
// pinned is the SHAPE: the switch acquired a second job because a later ticket wrote the span check inside
// its braces. Nothing went red, because nothing was watching the nesting. So this spec watches the nesting.
//
// ⚠️ SCOPE, stated because a check named "unconditional" sounds wider than it is: this measures the brace
// depth of the span comparison inside the handler. It catches re-wrapping in ANY conditional whatever the
// flag is called, and it catches the old module coming back. It does NOT catch a flag pushed down INSIDE
// lib/v2/entitlement.ts, which would be invisible here and belongs to that file's own specs.
// 🔴 MUTANT CONTRACT — measured 2026-08-30, not asserted from reading:
//   M1  the span comparison re-wrapped in `if (SOME_FLAG) {`  → 1 red here, control stays green
//   M2  the comparison replaced by `if (false) {`             → 8 red across this file,
//       calendar-month-gate-closed.test.tsx and calendar-span-gate.test.tsx
//   M3  FREE's calendar span widened 1 → 99 in lib/v2/entitlement.ts → 4 red in the two suites above
// ⚠️ M2 was first run with a stale indent and changed NOTHING, and the all-green result read exactly like
// a surviving mutant. Every run above now asserts the target string exists before it edits.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROUTE = resolve(__dirname, '../pages/api/v2/calendar-month.ts')

/**
 * Brace depth of the first line matching `needle`, counted from the line that opens `handler`.
 * Depth 1 = a statement of the handler body itself. Depth 2+ = wrapped in something.
 * Comments and strings are stripped first, so prose about braces cannot move the count.
 */
function depthOf(src: string, needle: string): number {
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.includes('export default async function handler'))
  if (start < 0) throw new Error('handler not found — this spec is pointed at the wrong file')
  let depth = 0
  for (let i = start; i < lines.length; i++) {
    const code = lines[i].replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '')
    if (lines[i].includes(needle)) return depth
    for (const ch of code) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
  }
  throw new Error(`not found in the handler: ${needle}`)
}

describe('#358 Phase 4 — the span gate is not wrapped in anything', () => {
  it('🔴 the span comparison is a statement of the handler body, not nested in a conditional', () => {
    const depth = depthOf(readFileSync(ROUTE, 'utf8'), 'if (!calendarMonthReachable(')
    expect(depth, 'a depth above 1 means something re-wrapped the package limit').toBe(1)
  })

  // 🔴 CONTROL — without this, a depthOf() that always returned 1 would pass the case above and look
  // exactly like a clean result. This feeds it the shape we are trying to forbid and requires a DIFFERENT
  // answer: same source, one extra `if`, nothing else changed.
  //
  // ⚠️ It asserts the DIFFERENCE, not the absolute 2. An earlier draft asserted 2 and went red under the
  // very mutant this file exists to catch — wrapping the real route made the control's own answer 3, so a
  // correct detector reported a broken control. A control must survive the mutation it is controlling for.
  it('🔴 CONTROL — one extra wrap reads exactly one level deeper, so the measure can move', () => {
    const src = readFileSync(ROUTE, 'utf8')
    const needle = 'if (!calendarMonthReachable('
    const wrapped = src.replace('  ' + needle, '  if (SOME_NEW_FLAG) {\n  ' + needle)
    expect(depthOf(wrapped, needle)).toBe(depthOf(src, needle) + 1)
  })

  it('🔴 the retired switch module is gone, and the route does not import it', () => {
    expect(existsSync(resolve(__dirname, '../lib/v2-calendar/gate.ts'))).toBe(false)
    expect(readFileSync(ROUTE, 'utf8')).not.toContain('CALENDAR_MONTH_GATE_OPEN =')
  })
})

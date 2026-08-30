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
  // exactly like a clean result. This feeds it the shape we are trying to forbid and requires a different
  // answer. It is the same source, wrapped in one `if`, so nothing but the nesting differs.
  it('🔴 CONTROL — the same source wrapped in one flag reads as depth 2, so the measure can fail', () => {
    const src = readFileSync(ROUTE, 'utf8')
    const wrapped = src.replace(
      '  if (!calendarMonthReachable(',
      '  if (SOME_NEW_FLAG) {\n  if (!calendarMonthReachable(',
    )
    expect(depthOf(wrapped, 'if (!calendarMonthReachable(')).toBe(2)
  })

  it('🔴 the retired switch module is gone, and the route does not import it', () => {
    expect(existsSync(resolve(__dirname, '../lib/v2-calendar/gate.ts'))).toBe(false)
    expect(readFileSync(ROUTE, 'utf8')).not.toContain('CALENDAR_MONTH_GATE_OPEN =')
  })
})

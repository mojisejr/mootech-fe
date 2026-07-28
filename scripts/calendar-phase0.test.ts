// Phase 0 calendar — pure-logic tests (state machine + matcher + grade + grid). Hooks are thin wrappers
// over these; the LOGIC is what can silently lie, so the teeth are here.
// Run: npx tsx scripts/calendar-phase0.test.ts
//
// ANCHOR: scripts/calendar-phase0.test.ts#save-flow-double-commit-latch
import assert from 'node:assert/strict'
import {
  saveFlowNext,
  hasCommittableDraft,
  SAVE_FLOW_TRANSITIONS,
  type ReminderDraft,
} from '../features/v2-calendar/save-flow'
import { dayCellTier, gradeRank, GRADES } from '../features/v2-calendar/grade'
import { CalendarMenuState, menuHasMateAi, menuStateForDay } from '../features/v2-calendar/menu-state'
import { buildMonthGrid, firstWeekday, daysInMonth } from '../features/v2-calendar/month-grid'
import { generateMonthDays, mockReminderList } from '../features/v2-calendar/fixtures'
import { isAppFetch } from '../harness/assert-no-app-fetch'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`)
    process.exitCode = 1
  }
}

// ── SAVE-FLOW state machine (the PR#97-class client side-effect) ──────────────────────────────────
t('happy path: idle→editing→saving→saved', () => {
  let s = saveFlowNext('idle', 'open')
  assert.equal(s, 'editing')
  s = saveFlowNext(s, 'commit')
  assert.equal(s, 'saving')
  s = saveFlowNext(s, 'resolve')
  assert.equal(s, 'saved')
})

// TEETH — double-commit / replay latch: a second commit while `saving` must be a NO-OP (one write, not two).
t('double-commit latch: commit while saving is a NO-OP (stays saving)', () => {
  assert.equal(saveFlowNext('saving', 'commit'), 'saving') // illegal edge → same state, NOT a 2nd write
})
t('replay after saved: commit while saved is a NO-OP', () => {
  assert.equal(saveFlowNext('saved', 'commit'), 'saved')
})
t('cancel from editing → idle (draft discarded, no ghost save)', () => {
  assert.equal(saveFlowNext('editing', 'cancel'), 'idle')
})
t('lost-response: saving with no resolve/reject stays saving (never silent success)', () => {
  // no such edge as "auto-succeed" — only resolve/reject leave saving
  assert.equal(saveFlowNext('saving', 'open'), 'saving')
  assert.equal(saveFlowNext('saving', 'toggleYam'), 'saving')
})
t('error → retry → saving (recovery edge exists)', () => {
  assert.equal(saveFlowNext('error', 'retry'), 'saving')
})
t('commit guard: empty ยาม selection is not committable', () => {
  const empty: ReminderDraft = { date: '2026-07-14', selectedYamIds: [], destinations: ['mumate'] }
  const one: ReminderDraft = { ...empty, selectedYamIds: ['y1'] }
  assert.equal(hasCommittableDraft(empty), false)
  assert.equal(hasCommittableDraft(one), true)
})
t('transition table has no accidental self-write on saving.commit', () => {
  assert.equal(SAVE_FLOW_TRANSITIONS.saving.commit, undefined) // the latch is DATA, not just code
})

// ── isAppFetch — the shared 0-network assertion matcher ───────────────────────────────────────────
t('app-data /api routes ARE app-fetch', () => {
  assert.equal(isAppFetch('http://localhost:3000/api/user?user_id=x'), true)
  assert.equal(isAppFetch('/api/home-fortune'), true) // relative form
  assert.equal(isAppFetch('http://localhost:3000/api/chinese-horoscope?userId=x'), true)
})
t('BE :4000 and bazi :3100 hosts ARE app-fetch', () => {
  assert.equal(isAppFetch('http://localhost:4000/chinese-horoscope'), true)
  assert.equal(isAppFetch('http://localhost:3100/api/home'), true)
})
// TEETH — must NOT false-flag framework infra, or a 0-app-fetch page can never go green.
t('NextAuth /api/auth/* is framework infra, NOT app-fetch', () => {
  assert.equal(isAppFetch('http://localhost:3000/api/auth/session'), false)
  assert.equal(isAppFetch('http://localhost:3000/api/auth/csrf'), false)
})
t('framework assets are NOT app-fetch', () => {
  assert.equal(isAppFetch('http://localhost:3000/_next/static/chunk.js'), false)
  assert.equal(isAppFetch('http://localhost:3000/favicon.ico'), false)
})

// ── dayCellTier — DESIGN.md thresholds (Good ≥60 · Medium 40–59 · Bad <40) ────────────────────────
t('dayCellTier boundaries', () => {
  assert.equal(dayCellTier(60), 'good')
  assert.equal(dayCellTier(59), 'medium')
  assert.equal(dayCellTier(40), 'medium')
  assert.equal(dayCellTier(39), 'bad')
  assert.equal(dayCellTier(0), 'bad')
  assert.equal(dayCellTier(100), 'good')
})
t('grade order A best → D- worst', () => {
  assert.equal(gradeRank('A'), 0)
  assert.equal(gradeRank('D-'), 9)
  assert.equal(GRADES.length, 10)
})

// ── menu-state contract ───────────────────────────────────────────────────────────────────────────
t('form-mode (4) has NO Mate AI; states 1-3 do', () => {
  assert.equal(menuHasMateAi(CalendarMenuState.FormMode), false)
  assert.equal(menuHasMateAi(CalendarMenuState.Normal), true)
  assert.equal(menuHasMateAi(CalendarMenuState.PrimaryAction), true)
  assert.equal(menuHasMateAi(CalendarMenuState.Saved), true)
})
t('day menu-state: has-reminder → Saved(3), else PrimaryAction(2)', () => {
  assert.equal(menuStateForDay(true), CalendarMenuState.Saved)
  assert.equal(menuStateForDay(false), CalendarMenuState.PrimaryAction)
})

// ── month-grid — deterministic, weeks of 7, correct real-day count ────────────────────────────────
t('buildMonthGrid: every week length 7, 31 real days, sequential', () => {
  const days = generateMonthDays(2026, 7)
  const weeks = buildMonthGrid(2026, 7, days)
  assert.ok(
    weeks.every((w) => w.length === 7),
    'every week must be length 7',
  )
  const real = weeks.flat().filter((c) => !c.isPadding)
  assert.equal(real.length, 31)
  assert.deepEqual(
    real.map((c) => c.day),
    Array.from({ length: 31 }, (_, i) => i + 1),
  )
  // leading padding count == weekday of the 1st (deterministic, independent recompute)
  const leadPadding = weeks[0].filter((c) => c.isPadding).length
  assert.equal(leadPadding, firstWeekday(2026, 7))
  assert.equal(daysInMonth(2026, 7), 31)
})

// ── §list superset — 2 groups, real counts ────────────────────────────────────────────────────────
t('reminder list groups into upcoming/past with correct totals', () => {
  const list = mockReminderList()
  assert.ok(list.upcoming.length >= 1)
  assert.ok(list.past.length >= 1)
  assert.equal(list.totalYams, list.upcoming.length + list.past.length)
})

console.log(`\ncalendar-phase0: ${pass} passed`)

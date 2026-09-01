// harness/585-work-lane-probe.ts — fire the colleague lane END TO END (mootech-fe#585).
//
// This is the API Truth for #585: the engine call, the trim, the index→slot join and the whole write
// transaction, against a real database and the real bazi engine. Unit tests cannot reach any of it — they
// prove "if the engine answers like this, we do that", and the two things this probe actually caught were
// both about what the engine really does.
//
// WHAT IT CAUGHT ON ITS FIRST RUN (2026-09-02)
//   ① `birthTime: ''` → HTTP 400 `too_small`.        A friend with no recorded hour killed the whole call.
//   ② omitting the key → HTTP 400 `invalid_type`.    /api/bazi/work has no unknown-hour mode at all,
//      although its sibling /api/bazi/pair-match does (route.ts:41,119,159). Hence the noon default and
//      the `time_known` column added in 0015.
//   Neither was visible from the code, and the first error message we got back said only "HTTP 400" —
//   which is why the client now carries the engine's own words.
//
// SAFE TO RUN: bazi's side is a pure compute with no side effects; every write lands in the local
// mumate_test database. ⛔ Never point DATABASE_URL at prod here — it spends a real quota unit.
//
// Run:
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
//   BAZI_BASE_URL=https://bazi-sft-dataset.vercel.app \
//   PROBE_USER=<a user_id that has >=3 friends with a dob> \
//   npx tsx harness/585-work-lane-probe.ts
import { db } from '@/lib/db'
import { memberWithFriend, workComparison, workComparisonCandidate, userMatching } from '@/lib/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { runWorkCompare } from '@/lib/matching/work-compare-flow'

const USER = process.env.PROBE_USER as string

async function main() {
  const friends = await db
    .select({ id: memberWithFriend.id, name: memberWithFriend.name, dob: memberWithFriend.dob })
    .from(memberWithFriend)
    .where(eq(memberWithFriend.userId, USER))
  const usable = friends.filter((f) => f.dob && f.dob !== '').slice(0, 3)
  console.log('เพื่อนที่ใช้:', usable.map((f) => `${f.id}=${f.name}`).join(' · '))

  const t0 = Date.now()
  const out = await runWorkCompare({ userId: USER, friendIds: usable.map((f) => String(f.id)) })
  console.log('ใช้เวลา (ms):', Date.now() - t0)
  console.log('ok:', out.ok, out.ok ? '' : (out as { kind: string }).kind)
  if (!out.ok) { console.log(JSON.stringify(out)); process.exit(1) }

  console.log('matching_id:', out.matchingId)
  console.log('entries:', out.entries.length)
  for (const e of out.entries) {
    console.log(`  rank=${e.rank} slot=${e.slot} person=${e.person.name} score=${e.rankScore} grade=${e.grade} roles=${e.roles.length} complete=${e.rolesComplete}`)
    for (const r of e.roles) console.log(`      · ${r.perspective}`)
  }

  const [row] = await db.select().from(workComparison).where(eq(workComparison.matchingId, out.matchingId))
  const cands = await db.select().from(workComparisonCandidate).where(eq(workComparisonCandidate.matchingId, out.matchingId))
  const [meter] = await db.select().from(userMatching).where(eq(userMatching.id, out.matchingId))
  console.log('--- ของที่ลงฐานข้อมูลจริง ---')
  console.log('work_comparison result bytes:', row?.result?.length)
  console.log('work_comparison_candidate rows:', cands.length, JSON.stringify(cands.map((c) => ({ slot: c.slot, score: c.rankScore }))))
  console.log('user_matching (มิเตอร์):', meter?.matchingType, 'friend_id =', meter?.friendId)
  process.exit(0)
}
main().catch((e) => { console.error('ล้ม:', e); process.exit(1) })

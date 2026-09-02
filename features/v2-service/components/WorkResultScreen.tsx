// features/v2-service/components/WorkResultScreen.tsx — #585 ก้อน 5, the colleague-lane result.
//
// WHY A SEPARATE SCREEN AND NOT THE LOVE ONE. ฟีม ruled it (ticket #585, ② จอผลทำใหม่แยก). The two
// screens share a design language but not a structure: love is "two people in one frame" and its hero
// (CompatResultHero.tsx:77-82,117-118) has the pair written into its signature. Work is a RANKED LIST of
// up to three, then one person at a time. Reusing the pair hero would mean widening the one component
// whose whole job is to draw exactly two.
//
// 🔴 ONE SOURCE OF ORDER. The ranked list and the tab strip are fed by the SAME `entries` array, which
// the server already returned in ranking order. If the tabs were ordered by `slot` (the order the user
// typed the names in) the screen would show two different orders at once — the badge in the middle of
// the card would say 1 while the leftmost tab was somebody else. บอง called that on the ticket and it is
// the reason `slot` is carried for debugging only.
//
// 🔴 NOTHING IS JOINED HERE. Each entry carries its own `person`. An earlier draft of the contract had
// the readings and the people as two lists to be paired by position, and the failure mode was a screen
// that looks completely normal with the wrong face over the wrong reading. The server merges them now
// and refuses (5xx) when the sets do not line up, so this file never indexes one list by the other.
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { Menubar } from '@/features/v2-shell/components/Menubar'
import { TopBarBell } from '@/features/v2-shell/components/TopBarBell'
import { TopBarAvatar } from '@/features/v2-shell/components/TopBarAvatar'
import { LoadingScreen } from '@/features/v2-shell/components/LoadingScreen'
import { gradeTier, TIER_COLOR, TIER_INK, pctWidth } from '../compat-result-parts'
import { useWorkResult } from '../hooks/useWorkResult'
import type { WorkEntry, WorkRole } from '../work-comparison'
import { orderRoles } from '../work-role-order'

function BackChevron() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** initials for someone with no photo — Figma 720:29221 draws "TG" in a tinted circle for exactly this */
function initialsOf(name?: string | null): string {
  const n = (name ?? '').trim()
  if (!n) return '—'
  // Thai names have no reliable word split for initials, so take the first rendered character. Array.from
  // walks CODE POINTS, not UTF-16 units: `n[0]` would cut a surrogate pair in half and render a box.
  return Array.from(n)[0] ?? '—'
}

function displayName(entry: WorkEntry): string {
  const first = (entry.person.name ?? '').trim()
  const last = (entry.person.surname ?? '').trim()
  const full = [first, last].filter(Boolean).join(' ')
  // NEVER a blank label: a nameless row is still a person the user chose, and an empty pill reads as a
  // broken screen rather than as missing data.
  return full || 'ไม่ทราบชื่อ'
}

function Avatar({ entry, size }: { entry: WorkEntry; size: number }) {
  const url = entry.person.pictureUrl?.trim()
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-v3-pastel-blue/40 font-bold text-v3-sapphire"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {initialsOf(entry.person.name)}
    </span>
  )
}

/** the score bar + grade pill, the one place a grade becomes a colour on this screen */
function ScoreRow({ entry }: { entry: WorkEntry }) {
  const tier = gradeTier(entry.grade)
  const pct = pctWidth(entry.rankScore)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-v3-ghost-white">
        <span
          data-testid={`work-score-bar-${entry.rank}`}
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: TIER_COLOR[tier] }}
        />
      </span>
      <span data-testid={`work-score-pct-${entry.rank}`} className="shrink-0 text-[13px] font-bold text-v3-text-body">
        {Math.round(entry.rankScore ?? 0)}%
      </span>
      {entry.grade ? (
        <span
          data-testid={`work-grade-${entry.rank}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
          style={{ backgroundColor: TIER_COLOR[tier], color: TIER_INK[tier] }}
        >
          {entry.grade}
        </span>
      ) : null}
    </div>
  )
}

/** one row of the ranked list — Figma 720:29221, the block under the blue hero */
function RankedRow({ entry }: { entry: WorkEntry }) {
  return (
    <li
      data-testid={`work-ranked-${entry.rank}`}
      data-slot={entry.slot}
      className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3"
    >
      <span className="relative shrink-0">
        <Avatar entry={entry} size={48} />
        {/* 🔴 The badge prints the engine's ranking or it does not print at all. `rankFromEngine` is false
            for anyone `comparison.ranking` never named: `readRankedCandidates` still shows them (losing a
            person the user paid for is worse than showing them last) but their position is OURS. A number
            in the engine's badge over an order we invented is the screen telling a confident lie, which is
            what ตู๋ caught on mootech-fe#593 — the row stays, the claim goes. */}
        {entry.rankFromEngine ? (
          <span
            data-testid={`work-rank-badge-${entry.rank}`}
            className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-v3-sapphire text-[11px] font-bold text-white"
          >
            {entry.rank}
          </span>
        ) : null}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[15px] font-bold leading-5 text-v3-navy">{displayName(entry)}</p>
        <ScoreRow entry={entry} />
      </div>
    </li>
  )
}

/**
 * one of the three role readings — Figma 720:29221 draws each as an icon, a bold heading and a paragraph.
 *
 * 🔴 THE ICON IS LEFT OUT ON PURPOSE, and this comment is the only place that is visible from the code.
 * The frame's three icons are a briefcase, an office block and a money bag, drawn for its sections
 * การงาน / ธุรกิจ / การเงิน. ฟีม overruled those headings on 2026-09-01 (`work-comparison.ts:11-15`)
 * because they name a domain of life while this content names a DIRECTION of a relationship. Keeping the
 * glyphs would put a money bag above a paragraph about a subordinate. Inventing three new glyphs is a
 * design decision that deserves the frame and ฟีม, not a guess made inside a chunk about completeness.
 * ⇒ heading and paragraph now, iconography as its own pass. Same reasoning as the PDF/แชร์ buttons below.
 *
 * `role.stageName` is carried by the contract and is NOT drawn here either, for the same reason. The love
 * lane does render a stage (`CompatPersonDetail.tsx:9,13`) but it is the stage of a PERSON's day pillar,
 * inside a subtitle that gives it context. This one is the stage of a role INTERACTION, and on its own it
 * lands as a bare word — "เจ๊าะ" under "ลูกน้อง → ตัวเรา" — that the reader cannot do anything with.
 * Giving it a label is a copy decision, not a completeness one.
 */
function RoleSection({ role, index }: { role: WorkRole; index: number }) {
  const heading = (role.perspective ?? '').trim()
  return (
    <section data-testid={`work-role-${index}`} data-perspective={heading} className="mt-4 border-t border-v3-ghost-white pt-4 first:mt-0 first:border-0 first:pt-0">
      {/* the heading is the engine's own `perspective` string, verbatim — ฟีม ทาง ก. We do not paraphrase
          it: every paraphrase is a second place the relationship direction could go wrong. */}
      <h3 data-testid={`work-role-heading-${index}`} className="text-[15px] font-bold leading-6 text-v3-navy">{heading}</h3>
      {role.narrative ? (
        <p data-testid={`work-role-narrative-${index}`} className="mt-2 whitespace-pre-line text-[15px] leading-[26px] text-v3-text-body">{role.narrative}</p>
      ) : null}
    </section>
  )
}

export function WorkResultScreen({ matchingId }: { matchingId: string }) {
  const router = useRouter()
  const state = useWorkResult(matchingId)
  // which tab is open, by RANK (1-based) — not by array position, so the value stays meaningful if the
  // list is ever re-fetched, and not by slot, which is debug-only.
  const [openRank, setOpenRank] = useState(1)

  if (state.status === 'loading') {
    return <LoadingScreen title="กำลังเปิดผลลัพธ์" subtitle="อีกสักครู่" />
  }

  const shell = (children: React.ReactNode) => (
    <div data-testid="work-result-screen" className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <div className="mx-auto w-full max-w-[430px] pb-28">
        <header className="flex items-center gap-3 px-5 pt-4">
          <button type="button" aria-label="ย้อนกลับ" data-testid="work-back" onClick={() => router.push('/v2/service/compatibility/recent')} className="text-v3-navy">
            <BackChevron />
          </button>
          <h1 data-testid="work-title" className="min-w-0 flex-1 truncate text-[24px] font-bold leading-8 text-v3-navy">ผลความสมพงศ์</h1>
          <TopBarBell />
          <TopBarAvatar />
        </header>
        {children}
      </div>
      <Menubar />
    </div>
  )

  // 🔴 The two failures say DIFFERENT things, because they are different for the person reading them.
  // "ไม่พบ" sends them back to their history; "เปิดไม่ได้" tells them it is ours and not to go looking
  // for a mistake of their own. A single blob here would be the defect #263 removed from the form screen.
  if (state.status === 'missing') {
    return shell(
      <p role="alert" data-testid="work-result-missing" className="px-6 pt-16 text-center text-[15px] leading-7 text-v3-text-body">
        <span className="block font-bold text-v3-navy">ไม่พบผลลัพธ์นี้</span>
        <span className="block">ลิงก์อาจเก่าไปแล้ว เปิดจากรายการดูดวงสมพงศ์ล่าสุดได้</span>
      </p>,
    )
  }
  if (state.status === 'failed') {
    return shell(
      <p role="alert" data-testid="work-result-failed" className="px-6 pt-16 text-center text-[15px] leading-7 text-v3-text-body">
        <span className="block font-bold text-v3-navy">เปิดผลลัพธ์ไม่ได้</span>
        <span className="block">ผลของคุณยังอยู่ ลองอีกครั้งในอีกสักครู่</span>
      </p>,
    )
  }

  const entries = state.entries
  if (entries.length === 0) {
    // A 200 with nothing in it is not a screen state we can dress up as a result.
    return shell(
      <p role="alert" data-testid="work-result-empty" className="px-6 pt-16 text-center text-[15px] leading-7 text-v3-text-body">
        <span className="block font-bold text-v3-navy">ผลลัพธ์นี้ยังไม่มีใครให้เทียบ</span>
        <span className="block">ลองคำนวณใหม่จากหน้าดูดวงเพื่อนร่วมงาน</span>
      </p>,
    )
  }

  // The open tab, resolved against what actually arrived — a rank that is not in the list falls back to
  // the first entry rather than rendering nothing. `entries` is already in ranking order, so [0] is rank 1.
  const open = entries.find((e) => e.rank === openRank) ?? entries[0]

  return shell(
    <>
      {/* hero — the sentence that says what the ranking IS, verbatim Figma 720:29221 */}
      <section className="mx-5 mt-4 rounded-3xl bg-v3-sapphire px-6 py-7 text-center text-white">
        <h2 data-testid="work-hero-title" className="text-[22px] font-bold leading-8">
          <span className="block">เพื่อนร่วมงาน</span>
          <span className="block">ที่เข้ากับคุณได้ดีที่สุดตามลำดับ</span>
        </h2>
      </section>

      {/* the ranked list — ONE source of order, shared with the tabs below */}
      <ol data-testid="work-ranked-list" className="mx-5 mt-4 flex flex-col gap-3">
        {entries.map((e) => <RankedRow key={e.person.friendId || e.rank} entry={e} />)}
      </ol>

      {/* ปุ่ม บันทึก PDF และ แชร์ อยู่ในเฟรมนี้ใน Figma และ **ไม่ได้วาดโดยตั้งใจ** — ฟีมเคาะข้อ ④ ว่าพักไว้
          แยกใบ เพราะยังไม่มี API รองรับ. เขียนไว้ตรงนี้เพราะการ "ไม่มี" มองไม่ออกจากโค้ด: คนถัดไปที่เทียบ
          จอกับเฟรมจะคิดว่าเราลืม แล้วเติมปุ่มที่กดแล้วไม่เกิดอะไรขึ้นกลับเข้ามา */}

      {/* tabs — same array, same order. data-rank so a test can prove the ORDER, not just the names. */}
      <nav data-testid="work-tabs" className="mx-5 mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="เลือกคนที่จะดูรายละเอียด">
        {entries.map((e) => {
          const active = e.rank === open.rank
          return (
            <button
              key={e.person.friendId || e.rank}
              type="button"
              data-testid={`work-tab-${e.rank}`}
              data-rank={e.rank}
              aria-pressed={active}
              onClick={() => setOpenRank(e.rank)}
              className={[
                'shrink-0 rounded-full px-4 py-2 text-[14px] font-bold transition-colors',
                active ? 'bg-v3-sapphire text-white' : 'bg-v3-pastel-blue/30 text-v3-sapphire',
              ].join(' ')}
            >
              {displayName(e)}
            </button>
          )
        })}
      </nav>

      {/* the open person's header block. The three role sections belong to ก้อน 6 and are NOT stubbed in
          with placeholder text: an empty section that looks finished is how a gap stops being noticed. */}
      <section data-testid="work-person" data-open-rank={open.rank} className="mx-5 mt-4 rounded-3xl bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar entry={open} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p data-testid="work-person-name" className="truncate text-[16px] font-bold leading-6 text-v3-navy">{displayName(open)}</p>
            <ScoreRow entry={open} />
          </div>
        </div>
        {open.ratingText ? (
          <p data-testid="work-person-summary" className="mt-3 whitespace-pre-line text-[15px] leading-[26px] text-v3-text-body">{open.ratingText}</p>
        ) : null}
        {/* 🔴 The engine promises three readings per person and sometimes returns fewer. The screen SAYS so.
            Rendering two headings and stopping would look complete, and the person paid a unit for three. */}
        {!open.rolesComplete ? (
          <p role="status" data-testid="work-roles-incomplete" className="mt-3 rounded-xl bg-v3-lemon-chiffon px-3 py-2 text-[14px] leading-[22px] text-v3-text-body">
            คำทำนายของคนนี้มาไม่ครบ ขาดอยู่ {open.rolesMissing} จาก 3 มุมมอง
          </p>
        ) : null}
        {/* the three readings, in a seat order this screen fixes — see work-role-order.ts for why the
            engine's array order is not it. `key` is the perspective so React does not reuse one role's
            paragraph under another's heading when the open tab changes. */}
        <div data-testid="work-roles" className="mt-4">
          {orderRoles(open.roles).map((r, i) => (
            <RoleSection key={`${open.rank}:${r.perspective ?? i}`} role={r} index={i + 1} />
          ))}
        </div>
      </section>
    </>,
  )
}

export default WorkResultScreen

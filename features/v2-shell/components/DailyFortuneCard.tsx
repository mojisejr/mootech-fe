// features/v2-shell/components/DailyFortuneCard.tsx — the "ดวงวันนี้" card, shared by home and ปฏิทินดวง.
//
// ฟีม 2026-08-03: "เอาอันนี้จากหน้า home ของ user มาใส่ด้วย … มันมีอยู่ในหน้าปฏิทินดวง" — and Figma agrees:
// `375:11100 daily-session-card` is a SUPERSET of home's card. Same 90px ring, same headline, same two
// columns; the calendar one adds a 干支 chip, a วันพระ row, two lines per column and a CTA.
//
// So this is ONE component with two variants rather than a second copy of a card we already ship. The
// division is deliberate:
//   • 'home'     reproduces home's CURRENT render byte-for-byte — gradient ground, verdict-coloured arc,
//                the "เปิดปฏิทินของฉัน" link, one line per column. Home's pixels must not move in a PR whose
//                subject is the calendar; the pixel-diff in the evidence is the proof, not the intention.
//   • 'calendar' is Figma's: white ground r28, the LIME disc behind the ring with sapphire numerals, date
//                line Bold 14/20, chips, two lines per column, and the sapphire CTA with lime uppercase text.
//
// WHY NOT MAKE HOME MATCH FIGMA TOO: that would change a shipped screen that ฟีม has already signed off, on
// my own initiative, inside an unrelated PR. It is a real question (the two cards genuinely disagree) and it
// belongs to him — logged, not silently decided.
import type { ReactNode } from 'react'

export type FortuneRing = {
  grade: string
  percent: number
  /** home only — the arc colour follows the verdict there. The calendar ring is Figma's fixed lime disc. */
  verdict?: 'good' | 'neutral' | 'caution'
}

export type DailyFortuneCardProps = {
  variant: 'home' | 'calendar'
  ring: FortuneRing
  headline: string
  /** the line under the first rule (home: "1 มิถุนายน 2569" · calendar: "วันนี้ · อังคารที่ 14 …") */
  dateLine: string
  /** home only — the small link that sits beside the date */
  dateAside?: ReactNode
  /** calendar only — 干支 chip + its meta text, and the วันพระ chip when the day is one */
  ganzhi?: string
  ganzhiMeta?: string
  wanPhra?: boolean
  wanPhraDetail?: string
  /** the two columns. home passes one string each; the calendar passes Figma's two lines. */
  suitable: string[]
  avoid: string[]
  /** calendar only — the CTA inside the card (Figma 375:11981) */
  footer?: ReactNode
  testId?: string
}

const VERDICT_ARC: Record<NonNullable<FortuneRing['verdict']>, string> = {
  good: 'text-v3-cyan',
  neutral: 'text-v3-lime',
  caution: 'text-v3-pumpkin',
}

// home's donut: an arc coloured by verdict on a translucent track. Unchanged from V2HomeScreen.
function HomeDonut({ grade, percent, verdict }: Required<Pick<FortuneRing, 'grade' | 'percent'>> & { verdict: NonNullable<FortuneRing['verdict']> }) {
  const r = 40
  const c = 2 * Math.PI * r
  // clamp ONCE (goo รู1): out-of-range data must never overflow the arc OR the label.
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className={`relative grid size-[90px] shrink-0 place-items-center ${VERDICT_ARC[verdict]}`}>
      <svg width="90" height="90" viewBox="0 0 90 90" className="absolute -rotate-90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
      </svg>
      <div className="relative text-center text-v3-navy">
        <p data-testid="fortune-grade" className="text-2xl font-bold leading-8">{grade}</p>
        <p data-testid="fortune-pct" className="text-sm leading-[22px]">{p}%</p>
      </div>
    </div>
  )
}

// Figma's donut (630:7724): a LIME disc under the ring, sapphire numerals, sapphire progress on a pale track.
function CalendarDonut({ grade, percent }: { grade: string; percent: number }) {
  const r = 40
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="relative grid size-[90px] shrink-0 place-items-center rounded-full bg-v3-lime">
      <svg width="90" height="90" viewBox="0 0 90 90" className="absolute -rotate-90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="#FFFFFF" strokeOpacity="0.65" strokeWidth="8" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="#1455A4" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} />
      </svg>
      <div className="relative text-center text-v3-sapphire">
        <p data-testid="fortune-grade" className="text-[24px] font-bold leading-8">{grade}</p>
        <p data-testid="fortune-pct" className="text-[14px] leading-[22px]">{p}%</p>
      </div>
    </div>
  )
}

function CheckCircleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4L15 9" /></svg>
}
function XCircleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></svg>
}

// The reserved height of home's facet row, exported so the Zone-1 SKELETON can wear the exact same class
// instead of a hand-copied pixel value. The two heights have to agree at every width or the reveal moves
// the page, and the only way to guarantee that is to make them the same string.
//
// It is responsive because the line count is: the same sentence wraps to more lines on a narrower screen.
// Measured over 60 real testenv fortunes rendered in this element — @320 3 lines, @360 a mix of 2 and 3,
// @393 2 — plus the longer shipped preview fixture, which reaches 4 lines at 320. So 320 reserves four
// lines (88px) and everything above reserves three (66px), which covers both the observed maximum and the
// fixture the design gate renders.
export const HOME_FACET_RESERVE = 'min-h-[88px] min-[360px]:min-h-[66px]'

// Same idea for the date row (date text + "เปิดปฏิทินของฉัน" on one line). At 320 the pair does not fit
// side by side and wraps to two lines; from 360 up it stays on one. That was the last 24px of the P4
// shift after the facet reserve landed — the skeleton drew a single 24px bar for a row the real card
// renders at 48px on the narrowest screen.
export const HOME_DATEROW_RESERVE = 'min-h-[48px] min-[360px]:min-h-6'

// The two variants place the icon DIFFERENTLY, and that is not cosmetic drift to be tidied away:
//   home     — heading alone, then the body line with the icon leading it (home's shipped markup)
//   calendar — icon + heading on one row (Figma 375:11124), then the lines underneath
// Home's pixels must not move in this PR, so the layout follows the variant instead of being unified.
function Column({ heading, lines, tone, icon, home }: { heading: string; lines: string[]; tone: 'cyan' | 'pumpkin'; icon: 'check' | 'cross'; home: boolean }) {
  // empty-facet guard (goo รู2): a facet can arrive empty — render a graceful "—", never a bare icon.
  const body = lines.map((l) => l.trim()).filter(Boolean)
  const list = body.length ? body : ['—']
  const toneClass = tone === 'cyan' ? 'text-v3-cyan' : 'text-v3-pumpkin'
  const glyph = <span aria-hidden className={`shrink-0 ${toneClass}`}>{icon === 'check' ? <CheckCircleIcon /> : <XCircleIcon />}</span>
  if (home) {
    return (
      <div className="min-w-0 flex-1">
        <p className={`text-base font-bold leading-6 ${toneClass}`}>{heading}</p>
        {/* RESERVE 3 LINES (home only — the calendar variant below is untouched).
            The Zone-1 skeleton is a fixed height while this text is not, so every fortune whose facet
            wrapped to a different line count moved the whole page under the user's thumb at the moment
            the data arrived: measured +18px at 393/360 and +64px at 320, and −4px (a jump UPWARD) for
            short ones. Reserving the row makes the card's height independent of the text, which is the
            only thing that can hold BOTH directions at once.
            Why three: measured, not picked. 60 real fortunes from the testenv stack, rendered in this
            element at each width — @320 all 3 lines, @360 a mix of 2 and 3, @393 all 2. Three is the
            observed maximum, and the @360 mix is the proof a reserve was needed rather than a taller
            skeleton: at one width the same component legitimately renders two different heights.
            min-h, never line-clamp: a longer future fortune must GROW rather than be cut. That reopens
            the shift for that fortune, which is the honest trade — losing a line of someone's reading is
            worse than a jump, and the harness will show it if the text ever outgrows the reserve. */}
        <p className={`mt-1 flex items-start gap-1.5 text-sm leading-[22px] text-v3-text-body ${HOME_FACET_RESERVE}`}>
          <span className="mt-0.5 shrink-0">{glyph}</span>
          <span data-testid="fortune-chip" className="min-w-0">{list.join(' ')}</span>
        </p>
      </div>
    )
  }
  return (
    <div className="min-w-0 flex-1">
      <p className={`flex items-center gap-2 text-[16px] font-bold leading-6 ${toneClass}`}>
        {glyph}
        {heading}
      </p>
      {list.map((line, i) => (
        <p key={i} data-testid="fortune-chip" className="mt-1 text-[14px] leading-[22px] text-v3-text-body">{line}</p>
      ))}
    </div>
  )
}

export function DailyFortuneCard(p: DailyFortuneCardProps) {
  const home = p.variant === 'home'
  return (
    <section
      data-testid={p.testId ?? 'daily-fortune-card'}
      data-variant={p.variant}
      className={home
        ? 'mb-8 flex flex-col gap-4 rounded-[28px] bg-gradient-to-b from-white to-v3-cyan/20 p-6 shadow-sm font-ibm'
        : 'flex flex-col gap-4 overflow-hidden rounded-[28px] bg-white p-6 font-ibm shadow-[0_4px_14px_rgba(26,38,77,0.06)]'}
    >
      <div className="flex items-center gap-4">
        {home
          ? <HomeDonut grade={p.ring.grade} percent={p.ring.percent} verdict={p.ring.verdict ?? 'neutral'} />
          : <CalendarDonut grade={p.ring.grade} percent={p.ring.percent} />}
        <p className={`min-w-0 flex-1 font-bold text-v3-navy ${home ? 'text-lg leading-6' : 'text-[18px] leading-6'}`}>{p.headline}</p>
      </div>

      <hr className="border-dashed border-v3-border-card" />

      {home ? (
        <div className={`flex items-center gap-4 text-base font-bold leading-6 ${HOME_DATEROW_RESERVE}`}>
          <p data-testid="fortune-date" className="min-w-0 flex-1 text-v3-navy">{p.dateLine}</p>
          {p.dateAside}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p data-testid="fortune-date" className="text-[14px] font-bold leading-5 text-v3-navy">{p.dateLine}</p>
          {p.ganzhi && (
            <span className="flex items-center gap-1.5">
              <span data-testid="fortune-ganzhi" className="rounded-full bg-v3-sapphire px-2 py-[3px] text-[11px] font-bold leading-none text-white">{p.ganzhi}</span>
              {p.ganzhiMeta && <span className="text-[11px] leading-none text-v3-text-body">{p.ganzhiMeta}</span>}
            </span>
          )}
          {p.wanPhra && (
            <span className="flex items-center gap-2">
              <span data-testid="fortune-wanphra" className="rounded-full bg-[#F1EFFA] px-[9px] py-1 text-[10px] font-bold leading-none text-[#AF9CE0]">🙏 วันพระ</span>
              {p.wanPhraDetail && <span className="text-[11px] leading-none text-v3-text-body">{p.wanPhraDetail}</span>}
            </span>
          )}
        </div>
      )}

      <hr className="border-dashed border-v3-border-card" />

      <div className="flex items-stretch gap-4">
        <Column heading="เหมาะกับวันนี้" lines={p.suitable} tone="cyan" icon="check" home={home} />
        <div className="self-stretch border-l border-dashed border-v3-border-card" />
        <Column heading="ควรเลี่ยง" lines={p.avoid} tone="pumpkin" icon="cross" home={home} />
      </div>

      {p.footer}
    </section>
  )
}

export default DailyFortuneCard

import type { ComponentType, ReactNode, SVGProps } from 'react'
import Image from 'next/image'
import { Activity, Check, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MascotResult } from '@/lib/personalization/mascot'
import { FirstRunScreen } from './FirstRunScreen'
import {
  ElementEarthIcon,
  ElementFireIcon,
  ElementMetalIcon,
  ElementWaterIcon,
  ElementWoodIcon,
  InfoIcon,
} from './icons'

// ElementResultScreen — "ธาตุของคุณคือ ไม้" (Figma node 300:2356; the frame is still NAMED "04-pdpa"
// in the file — a duplicate that was never renamed. Content confirms it is screen 05.)
//
// The long one: 1853px at 375 wide, so this screen SCROLLS. FullBleedScreen's min-h-screen (not a
// fixed height) is what lets it grow instead of clipping.
//
// #233 Phase 3 turned this from a fixture screen into a real one. What changed and WHY it matters:
//
//   • The screen no longer OWNS the six-facet values. They live in DB `element_cycle`, keyed by
//     (element, power, gender) — 20 rows, and v1 already reads the same six columns at
//     components/box-info.tsx:241-246. A five-row table in here would be a second copy that loses
//     to the real one: right for 1 key, wrong for the other 19, and wrong-looking-right every time.
//   • gender is part of that key and `user.gender` is NULLABLE (schema.ts:890) while
//     `element_cycle.gender` is notNull (schema.ts:334). A missing gender therefore has no row —
//     and it must NOT be defaulted. Proof it changes the answer, from the real table:
//         WOOD/YANG/MALE   → spouse = EARTH
//         WOOD/YANG/FEMALE → spouse = METAL
//     `gender ?? 'MALE'` would silently show one person's chart to another. This repo already wrote
//     that rule down after fixing the same bug once: features/v2-service/compatibility-api.ts:12-19.
//     Ruling on #233: cycle === null → hide the block and say so. Never guess. See MUTANT CONTRACT
//     in scripts/first-run-screens.test.tsx.
//
// 🔴 The Figma frame's facet values are NOT the product's values. The frame draws
//    work=METAL / career=FIRE; the real row for WOOD/YANG/MALE is work=FIRE / career=METAL — the two
//    are swapped, and the classic wu-xing derivation (output=FIRE, officer=METAL) agrees with the DB,
//    not with the frame. Read the row, never the picture. Reported on #233.
//
//   • intro / traits / advice come from POST /api/bazi/element-summary — a per-person reading keyed
//     by ก้าน/ราศี/เชี่ยงแซ (60 ดิถี), so two ธาตุไม้ people do not get the same paragraph.
//     🔎 This was NOT known when the screen was built: the first pass here grepped the repo and the
//     schema, found nothing, and concluded the words had to be authored per element (#237). The API
//     was found later, on the bazi side, in a doc that names this very screen. Worth keeping as the
//     shape of the mistake: "I searched and found nothing" is a fact about the search, not about the
//     world — the summary had never been wired to a caller, so nothing in THIS repo pointed at it.
//     No source is missing when there is no ELEMENT_COPY left here; there is one until #237 lands.
//   • Any of the three blocks is dropped when its data is absent, rather than filled with another
//     element's words. The heading above them is already correct, so borrowed copy reads as a truer
//     lie than an empty space. Same rule when the API is slow or down: those blocks go, the rest stays.

export type ElementKey = 'WOOD' | 'METAL' | 'FIRE' | 'EARTH' | 'WATER'

// Colours come from the DESIGN.md v3 §2 element ICON palette (tailwind `v3-el-*`), NOT the hexes
// baked into this Figma node. The node draws #2EA214/#E7B101/#D70909/#D57018 where the contract says
// #55B43F/#EBBF30/#DC2727/#DC8B43 (WATER agrees at #14ADFF). Following the contract keeps one green
// for ธาตุไม้ across the app instead of two; the delta is reported on issue #215 and flipping it is
// a one-line change here.
const ELEMENT: Record<
  ElementKey,
  { th: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }
> = {
  WOOD: { th: 'ธาตุไม้', Icon: ElementWoodIcon, tone: 'text-v3-el-wood' },
  METAL: { th: 'ธาตุทอง', Icon: ElementMetalIcon, tone: 'text-v3-el-metal' },
  FIRE: { th: 'ธาตุไฟ', Icon: ElementFireIcon, tone: 'text-v3-el-fire' },
  EARTH: { th: 'ธาตุดิน', Icon: ElementEarthIcon, tone: 'text-v3-el-earth' },
  WATER: { th: 'ธาตุน้ำ', Icon: ElementWaterIcon, tone: 'text-v3-el-water' },
}

function isElementKey(v: string | null | undefined): v is ElementKey {
  return typeof v === 'string' && v in ELEMENT
}

export type FacetRow = { label: string; element: ElementKey }

/**
 * One row of DB `element_cycle` (the six facet columns + the polarity that keys it).
 * Values are the uppercase enum the table stores — 'WOOD' | 'METAL' | 'FIRE' | 'EARTH' | 'WATER'.
 * Typed as `string` on purpose: this crosses the DB boundary, so it is only an ElementKey once
 * buildFacets() has checked it. A row that fails that check hides the block instead of half-drawing it.
 */
export type ElementCycleRow = {
  power: string
  friend: string
  work: string
  career: string
  fortune: string
  spouse: string
  supporter: string
}

/**
 * Four states, because `T | null` was three different situations wearing the same face:
 * "we are still asking", "there is genuinely nothing", and "we could not find out". The screen has
 * to say something different for each — a user whose call TIMED OUT was being told their profile was
 * incomplete, which is a lie about the cause and sends them to fix the wrong thing (#233 reframe).
 *
 * `unavailable` is a real answer: no gender ⇒ no element_cycle row ⇒ the block cannot exist yet.
 * `error` is the absence of an answer. Never collapse the two again.
 */
export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'unavailable' }
  | { status: 'error' }

/** What the caller (goo's selector, #233) hands in. */
export type ElementResultSource = {
  /** The whole MascotResult — `card` is the (นักษัตร, ธาตุ) artwork path, which the element alone cannot build. */
  mascot: Pick<MascotResult, 'card' | 'elementTh' | 'elementLabelTh' | 'elementEn'>
  /**
   * DB `element_cycle`. Expected to arrive with the page — it is one indexed query, and the reframe
   * ruling is that art + ธาตุ + facets paint immediately. `loading` is still handled rather than
   * assumed away: an assumption about latency is not a guarantee about it.
   */
  cycle: AsyncState<ElementCycleRow>
  /**
   * POST /api/bazi/element-summary. This one IS slow — worst case ~10s measured on the bazi side, so
   * it is prefetched at register and this screen may well meet it mid-flight.
   */
  summary: AsyncState<ElementSummary>
}

/**
 * The bazi service's per-person reading — POST /api/bazi/element-summary (found on #233 after this
 * screen was already built). It is keyed by the user's ก้าน/ราศี/เชี่ยงแซ, i.e. 60 ดิถี, NOT by the
 * five elements: two people who are both ธาตุไม้ get different words. That makes any five-row table
 * written in here strictly coarser than what already exists — the same reason the facet values are
 * read from `element_cycle` rather than typed out. `null` = the call failed, was slow, or has not
 * been wired yet; the screen then drops these blocks and keeps the rest.
 *
 * ⚠️ NOT yet verified against a real response — typed from docs/newui-api.md via #233. goo is posting
 * a raw body on the issue; check the field names against it before trusting this, and do not let a
 * green test stand in for that (the type is a description of the API, not the API).
 */
export type ElementSummary = {
  tagline: string
  traits: string[]
  advice: { key: string; label: string; text: string }[]
  /** The service also returns this. It is deliberately UNUSED — see the note in the component. */
  elementTh?: string
}

export type AdviceItem = { key?: string; label?: string; text: string }
export type ElementCopy = { intro: string; traits: string[]; advice: AdviceItem[] }

// INTERIM, and scheduled for deletion (#237). This is the ธาตุไม้ copy transcribed off the Figma
// frame in #215 — it predates the discovery that /api/bazi/element-summary already returns a better,
// per-person version of exactly these three blocks. `summary` WINS wherever it is present; this only
// still exists so that removing it does not blank out the one screen that ships content today.
//
// When goo's proxy lands: delete this constant and the `?? ELEMENT_COPY[...]` below. The test
// "prefers the service reading over the local copy" already proves nothing else depends on it.
// Do not add the other four elements here — that is the coarse five-row table this screen refuses.
export const ELEMENT_COPY: Partial<Record<ElementKey, ElementCopy>> = {
  WOOD: {
    intro:
      'สัญลักษณ์แห่งความเจริญรุ่งเรือง และการเริ่มต้นใหม่ คุณคือผู้สร้าง แรงบันดาลใจและมีพลังชีวิตที่เข้มแข็ง',
    traits: [
      'มีความคิดริเริ่มสร้างสรรค์และจินตนาการกว้างไกล',
      'เห็นอกเห็นใจผู้อื่นและมีความโอบอ้อมอารี',
      'มีความเป็นผู้นำและพร้อมจะเติบโตอยู่เสมอ',
    ],
    advice: [
      { text: 'รักษาสมดุลพลังงานด้วยการใช้เวลาท่ามกลางธรรมชาติบ่อยๆ' },
      { text: 'ออกกำลังกายเบาๆ อย่างสม่ำเสมอเพื่อช่วยให้ลมปราณไหลเวียน' },
    ],
  },
}

// Column -> on-screen label, in the order the Figma frame stacks them. The KEY order is the contract:
// v1 renders the same six in the same order (components/box-info.tsx:241-246).
const FACETS: ReadonlyArray<[keyof Omit<ElementCycleRow, 'power'>, string]> = [
  ['friend', 'เพื่อน/พี่น้อง/หุ้นส่วน'],
  ['work', 'เรียน/ทำงาน/ลงทุน'],
  ['career', 'หน้าที่การงาน'],
  ['fortune', 'โชคลาภ'],
  ['spouse', 'คู่ครอง'],
  ['supporter', 'ผู้สนับสนุน/ส่งเสริม'],
]

/**
 * Six rows, or null. Null when there is no cycle row at all, OR when any single value is not an
 * element we can draw — a five-of-six table would silently drop a facet, and a dropped row looks
 * exactly like a facet that does not exist. All six or none.
 */
export function buildFacets(cycle: ElementCycleRow | null | undefined): FacetRow[] | null {
  if (!cycle) return null
  const rows: FacetRow[] = []
  for (const [key, label] of FACETS) {
    const value = cycle[key]
    if (!isElementKey(value)) return null
    rows.push({ label, element: value })
  }
  return rows
}

/**
 * "ธาตุไม้" + "หยิน" -> "ธาตุไม้หยิน". An unrecognised power returns the element label ALONE:
 * the polarity is real data, so the screen either states it or omits it — it never invents one.
 */
export function polarityTitle(elementLabelTh: string, power: string | null | undefined): string {
  const suffix = power === 'YIN' ? 'หยิน' : power === 'YANG' ? 'หยาง' : ''
  return `${elementLabelTh}${suffix}`
}

// The service tags each advice item with a `key` ('talent' | 'health'). Picking the glyph off the
// ARRAY POSITION instead would silently swap the meanings the day the service returns them in the
// other order — an index standing in for an identity, which is how the 8-gate compass went wrong in
// #190. Unknown keys fall back to the neutral glyph rather than to "whatever is at slot 0".
const ADVICE_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  talent: Leaf,
  health: Activity,
}

/**
 * Grey bar placeholder. `motion-safe:` rather than a bare `animate-pulse` (which is what
 * CalendarSkeleton uses): a reader who asked the OS for less motion should not get a pulsing block,
 * and it also makes the loading state photographable — a screenshot of an animation lands wherever
 * the playhead happened to be, so the design-verify shot of this state would never be twice the same.
 */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`motion-safe:animate-pulse rounded bg-v3-ghost-white ${className}`} />
}

/** 20px ghost-white chip + 12px cyan glyph — the bullet used by both list cards. */
function BulletRow({
  Icon,
  children,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  children: ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-v3-ghost-white">
        {/* size 12 at strokeWidth 4: lucide draws on a 24 viewBox, so rendering it at half size
            halves the stroke too — 4 lands back on the 2px the Figma 12×12 export has. */}
        <Icon className="size-3 text-v3-cyan" strokeWidth={4} aria-hidden="true" />
      </span>
      <span className="min-w-0 font-ibm text-sm leading-[22px] text-v3-text-muted">{children}</span>
    </li>
  )
}

export function ElementResultScreen({
  source,
  onBack,
  onReadFull,
  onGoHome,
}: {
  // Required. There is deliberately no default fixture: a screen that renders somebody else's chart
  // when handed nothing is the failure mode this whole phase exists to remove.
  source: ElementResultSource
  onBack?: () => void
  onReadFull?: () => void
  onGoHome?: () => void
}) {
  const { mascot, cycle, summary } = source
  const row = cycle.status === 'ready' ? cycle.data : null
  const facets = buildFacets(row)
  // A row that arrived but could not be read is not the same as no row: the data is there and it is
  // wrong, which is our problem to fix, not the user's profile to complete.
  const facetState: AsyncState<unknown>['status'] =
    cycle.status === 'ready' && !facets ? 'error' : cycle.status

  // The service reading wins. Falling back the other way round would mean a person whose API call
  // succeeded still reads the generic ธาตุไม้ paragraph.
  const local = isElementKey(mascot.elementEn) ? ELEMENT_COPY[mascot.elementEn] : undefined
  const copy: ElementCopy | undefined =
    summary.status === 'ready'
      ? {
          intro: summary.data.tagline,
          traits: summary.data.traits,
          advice: summary.data.advice,
        }
      : // `unavailable` = nothing was ever going to come (not wired / none for this element), so the
        // interim ธาตุไม้ copy may stand in. `error` may NOT: substituting generic words for a failed
        // personal reading presents a fallback as the user's own result.
        summary.status === 'unavailable'
        ? local
        : undefined

  // Two services can name the element, and only one of them may be believed: `mascot` is what the
  // home greeting uses, so reading the other here is how the same user gets told two different
  // elements on two consecutive screens. Disagreement is a real signal — say so, do not paper over it.
  if (
    summary.status === 'ready' &&
    summary.data.elementTh &&
    summary.data.elementTh !== mascot.elementTh
  ) {
    console.warn(
      `[element-result] element mismatch: mascot="${mascot.elementTh}" summary="${summary.data.elementTh}" — rendering mascot`,
    )
  }

  return (
    <FirstRunScreen
      step={2}
      onBack={onBack}
      contentClassName="gap-8 px-6 py-8"
      footer={
        <div className="flex flex-col gap-2">
          <Button onClick={onReadFull}>อ่านดวงของฉันทั้งหมด</Button>
          <Button variant="tertiary" onClick={onGoHome}>
            เข้าสู่หน้าหลัก
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 text-center">
        <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
          ธาตุของคุณคือ {mascot.elementTh}
        </h1>
        {copy ? (
          <p className="font-ibm text-base leading-6 text-v3-text-body">{copy.intro}</p>
        ) : summary.status === 'loading' ? (
          <div className="flex flex-col items-center gap-2" data-testid="intro-loading" aria-busy>
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-4/5" />
          </div>
        ) : null}
      </div>

      {/* Hero art. width/height are the artwork's real pixels so next/image keeps the intrinsic
          aspect; the box is fluid, which is what carries it from 320 to 430. */}
      <Image
        src={mascot.card}
        alt=""
        aria-hidden="true"
        width={1087}
        height={1506}
        sizes="(max-width: 448px) 100vw, 448px"
        priority
        className="h-auto w-full rounded-3xl"
      />

      {/* The three cards are 8px apart from each other, while the blocks above them are 32 apart —
          so they get their own stack instead of riding the page's gap-8. */}
      <div className="flex flex-col gap-2">
        {/* facet card. Not glass: the white/65 + backdrop-blur reading came from the same polluted
          export as the cream background, and against ghost-white it renders visibly blue. */}
        <section className="rounded-2xl bg-white px-4 py-6">
          {/* With a row, this is the polarity — "ธาตุไม้หยาง" — which the h1 above does not already
              say. WITHOUT a row there is no polarity, so it collapses to "ธาตุทอง" directly under
              "ธาตุของคุณคือ ทอง": a duplicate heading that leaves the block unnamed at exactly the
              moment the reader needs to know what they are missing. Caught by looking at the render,
              not by any number in the harness table — every count was already green. */}
          <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
            {facets ? polarityTitle(mascot.elementLabelTh, row?.power) : 'ธาตุที่ส่งผลในแต่ละด้าน'}
          </h2>
          {facets ? (
            <>
              <p className="mt-3 font-ibm text-sm leading-[22px] text-v3-text-body">
                ธาตุที่ส่งผลในเเต่ละด้านของคุณ วิเคราะห์ธาตุในเเต่ละด้าน
              </p>
              <dl className="mt-3" data-testid="facet-list">
                {facets.map(({ label, element }) => {
                  const el = ELEMENT[element]
                  return (
                    <div
                      key={label}
                      // every row carries its top rule, including the first — Figma draws one right under
                      // the subtitle (588:10528) before the first row starts
                      className="flex items-center gap-2 border-t border-v3-border-card py-3"
                    >
                      <dt className="min-w-0 flex-1 font-ibm text-sm leading-[22px] text-v3-text-body">
                        {label}
                      </dt>
                      <dd className="flex shrink-0 items-center gap-2">
                        <el.Icon className={`size-6 ${el.tone}`} />
                        {/* the element NAME stays neutral — colour lives only in the glyph (DESIGN.md §2) */}
                        <span className="font-ibm text-sm leading-[22px] text-v3-text-body">
                          {el.th}
                        </span>
                      </dd>
                      <InfoIcon className="size-[19px] shrink-0 text-v3-cyan" />
                    </div>
                  )
                })}
              </dl>
            </>
          ) : facetState === 'loading' ? (
            <div className="mt-3 flex flex-col gap-3" data-testid="facet-loading" aria-busy>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2 border-t border-v3-border-card py-3">
                  <Bar className="h-4 flex-1" />
                  <Bar className="h-4 w-20 shrink-0" />
                </div>
              ))}
            </div>
          ) : facetState === 'error' ? (
            // NOT "your profile is incomplete". Nothing is missing from the user's side — we failed
            // to read it. Telling them to complete a profile that is already complete sends them off
            // to fix the wrong thing, and hides a fault of ours behind their supposed mistake.
            <p
              data-testid="facet-error"
              className="mt-3 font-ibm text-sm leading-[22px] text-v3-text-muted"
            >
              ตอนนี้ดึงข้อมูลธาตุรายด้านไม่สำเร็จ ไม่ใช่เพราะข้อมูลของคุณขาด ลองเปิดหน้านี้ใหม่อีกครั้งได้เลย
            </p>
          ) : (
            // Says WHY, and says nothing about which value is missing — the cause may be a null
            // gender or a lookup miss, and naming a guess here is how the guess gets believed.
            <p
              data-testid="facet-unavailable"
              className="mt-3 font-ibm text-sm leading-[22px] text-v3-text-muted"
            >
              ยังคำนวณธาตุรายด้านให้ไม่ได้ เพราะข้อมูลโปรไฟล์ของคุณยังไม่ครบ
              เมื่อข้อมูลครบแล้วส่วนนี้จะแสดงให้อัตโนมัติ
            </p>
          )}
        </section>

        {/* Loading and error for the reading live here, once, rather than on each of the two cards:
            they come from ONE call, so two spinners or two error notes would tell the reader there
            were two failures. `unavailable` stays silent — there is nothing to wait for and nothing
            went wrong; the blocks simply do not apply. */}
        {summary.status === 'loading' && !copy ? (
          <section
            className="flex flex-col gap-4 rounded-2xl bg-white p-4"
            data-testid="summary-loading"
            aria-busy
            aria-live="polite"
          >
            <Bar className="h-5 w-40" />
            <div className="flex flex-col gap-3">
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-11/12" />
              <Bar className="h-4 w-3/4" />
            </div>
          </section>
        ) : null}

        {summary.status === 'error' ? (
          <section
            className="rounded-2xl bg-white p-4"
            data-testid="summary-error"
            aria-live="polite"
          >
            <p className="font-ibm text-sm leading-[22px] text-v3-text-muted">
              โหลดคำอ่านของคุณไม่สำเร็จ ธาตุและภาพด้านบนถูกต้องแล้ว ลองเปิดหน้านี้ใหม่เพื่อดูคำอ่าน
            </p>
          </section>
        ) : null}

        {copy ? (
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-4">
            <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
              ลักษณะเด่นของคุณ
            </h2>
            <ul className="flex flex-col gap-3">
              {copy.traits.map((t) => (
                <BulletRow key={t} Icon={Check}>
                  {t}
                </BulletRow>
              ))}
            </ul>
          </section>
        ) : null}

        {copy ? (
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-4">
            <h2 className="font-ibm text-base font-bold leading-6 text-v3-text-title">
              คำแนะนำเบื้องต้น
            </h2>
            <ul className="flex flex-col gap-3">
              {copy.advice.map((a, i) => (
                <BulletRow key={a.key ?? a.text} Icon={(a.key && ADVICE_ICON[a.key]) || Activity}>
                  {/* The service names each piece of advice ("การใช้จุดแข็ง" / "การดูแลตัวเอง").
                      Dropping the label — which the first cut of this did — turns two differently
                      purposed items into two indistinguishable paragraphs, and throws away content
                      the API went to the trouble of structuring. The Figma frame has no label
                      because the frame predates the service. */}
                  {a.label ? <strong className="font-semibold">{a.label}: </strong> : null}
                  {a.text}
                </BulletRow>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </FirstRunScreen>
  )
}

export default ElementResultScreen

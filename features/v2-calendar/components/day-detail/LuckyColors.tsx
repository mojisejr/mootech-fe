// §10 "ทิศ สีมงคล" — the day's auspicious colours, grouped by element, + เทพประจำวัน.
//
// M-D (มุน 2026-08-06) — V1 decided, and the answer turned out to need NO new colour.
//
// The pipe sends `{element: 'ไม้', colors: 'เขียว'}` — Thai colour NAMES, deliberately not hexes, because
// turning a name into a hex is a design decision the pipe must not make. The previous version showed five
// swatches whose hexes were sampled off Figma's pixels, which quietly asserted that "ฟ้า" is exactly
// #FFFCE1 forever.
//
// What the data actually is: `element → colours` is a FIXED function (every element always yields the same
// names), so with five elements the vocabulary is CLOSED at thirteen names, all single words. And the pipe
// already groups them by element, which is the one thing the screen needs — because DESIGN.md §Element
// colors already carries a per-element TEXT palette chosen for legibility (WCAG ≥4.5:1 on white; I
// re-measured all five on this card's white ground: ไม้ 5.48 · ทอง 5.69 · ไฟ 5.44 · ดิน 7.63 · น้ำ 7.10).
// So the colour names are simply SET in their own element's colour. No new hex enters the system, and the
// canonical source stays lib/calculator/elements.ts rather than a second copy here.
//
// COLOUR LIVES IN THE GLYPH, NOT THE WORDS — DESIGN.md says so, and looking at the render showed exactly
// why. The first version set each colour NAME in its element's ink, which reads fine for ธาตุไม้ ("เขียว"
// in green) and actively lies for ธาตุทอง: "ขาว" painted gold. The reader takes the ink as the colour being
// named, so the one row where ink and word disagree is the row that misinforms. The element ink now sits in
// a dot that identifies the ELEMENT, and every colour word is neutral — which is what the document said in
// the first place.
//
// NOT DONE: one swatch per individual colour name (13 new hexes). That is taste and brand, ฟีม's call, and
// the feature — "what colour should I wear today" — is already answered by the names. Raised, not shipped.
import type { DayDetailColor } from '../../types'
import { SectionCard } from './SectionCard'
import { ELEMENT_COLOR, ELEMENT_LABEL_TH, type BaziElement } from '@/lib/calculator/elements'

/** ไม้/ไฟ/ดิน/ทอง/น้ำ → the enum, by inverting the canonical Thai labels (no second list to drift). */
const TH_TO_ELEMENT: Record<string, BaziElement> = Object.fromEntries(
  (Object.keys(ELEMENT_LABEL_TH) as BaziElement[]).map((e) => [ELEMENT_LABEL_TH[e], e]),
)

/** An unknown element still SHOWS its colours — in neutral ink rather than being dropped or guessed. */
const NEUTRAL = '#464646'

/**
 * A ทิศมงคล row was added here and then REMOVED (มุน 2026-08-06, on บอง's duplication warning): the score
 * card already carries the direction as a chip on the same screen, so this would have been a third surface
 * for one value. The section keeps Figma's title; the direction it names is shown above it.
 */
export function LuckyColors({ colors, deity }: { colors: DayDetailColor[]; deity: string }) {
  return (
    <SectionCard
      title="ทิศ สีมงคล"
      testId="lucky-colors"
      // ฟีม's words, verbatim (#565). Three labelled lines rather than one paragraph: each one answers a
      // different question, and the labels are what let a reader find the one they came for.
      info={
        <dl className="flex flex-col gap-2">
          <div>
            <dt className="font-bold text-v3-navy">สี</dt>
            <dd>ใส่เสื้อสีมงคลเพื่อความราบรื่นในวันนี้</dd>
          </div>
          <div>
            <dt className="font-bold text-v3-navy">ทิศ</dt>
            <dd>ใช้เชิงฐานก่อนออกจากบ้าน ว่าท่าสิ่งใดในวันนี้ให้สำเร็จ หรือจะไปทิศมงคลนั้น เมื่อเทียบกับบ้านหรือที่ทำงาน</dd>
          </div>
          <div>
            <dt className="font-bold text-v3-navy">เทพ</dt>
            <dd>เมื่อมีปัญหาหรือต้องการความมั่นใจในความสำเร็จมากขึ้น ระหว่างวัน สามารถขอพรองค์ท่านที่ศาลเจ้า (ดีสุด)</dd>
          </div>
        </dl>
      }
    >
      <div className="flex flex-col gap-3">
        {colors.length === 0 && <p className="text-sm text-v3-text-muted">วันนี้ไม่มีข้อมูลสีมงคล</p>}
        {colors.map((c, i) => {
          const el = TH_TO_ELEMENT[c.element?.trim()]
          const ink = el ? ELEMENT_COLOR[el] : NEUTRAL
          return (
            <div key={`${c.element}-${i}`} data-testid="lucky-color-row" data-element={c.element} className="flex items-baseline justify-between gap-3">
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium" style={{ color: NEUTRAL }}>
                {/* the dot carries the ELEMENT; the words stay neutral so no ink contradicts a colour name */}
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: ink }} />
                ธาตุ{c.element}
              </span>
              <span className="text-right text-base font-bold leading-6" style={{ color: NEUTRAL }}>{c.colors}</span>
            </div>
          )
        })}
        <div className="flex items-center justify-between gap-3 border-t border-dashed border-[#EBD9C8] pt-3">
          <span className="text-sm font-medium text-v3-text-body">เทพประจำวัน</span>
          <span className="text-base font-bold text-v3-sapphire">{deity || '—'}</span>
        </div>
      </div>
    </SectionCard>
  )
}

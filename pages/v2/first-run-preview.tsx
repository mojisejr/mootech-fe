// Preview of the three post-first-login screens (issue #215). Visibility is owned by the v2 preview
// gate (V2_PREVIEW_KEY cookie), NOT by NODE_ENV — same guard as the 10 real /v2 pages, so ฟี/ตู๋ can
// open it on a Vercel/prod deploy after the passkey instead of being 404'd (issue #220). Nothing is
// mounted into a real flow yet: first-login detection and routing are ใบ 3, so this page is the ONLY
// way in — no login, no user, no backend.
//
//   ?step=intent|pdpa|element   which screen (default: intent)
//   ?goal=finance|health|family|growth|love|work|none   intent-check selection
//                               (default: health — the state Figma 300:1548 draws)
//   ?consent=1                  pdpa starts ticked → button ACTIVE (Figma 300:2137)
//                               omitted → unticked → button DISABLED (Figma 300:1582)
//   ?element=wood|metal|fire|earth|water   which element the result screen shows (default: wood)
//   ?gender=male|female         swaps the cycle row (WOOD only — see below). Proves the row, and
//                               therefore the คู่ครอง facet, is different per gender.
//   ?cycle=none                 force cycle=null → the "profile incomplete" state, no facet block
//   ?summary=real               render the VERBATIM body of /api/bazi/element-summary (#233) instead
//                               of the interim ธาตุไม้ copy — the real strings are much longer than
//                               the ones the Figma frame was drawn with
//
// The two PDPA frames are one screen in two states, so they are one URL knob, not two routes —
// which is what lets a design-verify pass shoot both from the same build with no source patch.
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import {
  ElementResultScreen,
  type ElementCycleRow,
  type ElementResultSource,
} from '@/features/v2-first-run/components/ElementResultScreen'
import { IntentCheckScreen, type GoalId } from '@/features/v2-first-run/components/IntentCheckScreen'
import { PdpaConsentScreen } from '@/features/v2-first-run/components/PdpaConsentScreen'
import { buildMascotPaths } from '@/lib/personalization/mascot'

// The two rows below are TRANSCRIBED VERBATIM from the real `element_cycle` table (goo's dump on
// #233, read off สนาม :5433 which restores the prod DB). They are the only rows we have on hand.
//
// 🔴 They also disagree with the Figma frame this screen was built from: the frame draws
//    work=METAL / career=FIRE, the table says work=FIRE / career=METAL. The table wins — reported
//    on #233. Do not "fix" these back to match the picture.
//
// The other four elements have real rows in the table too, they were just not in the dump; until
// they are, this preview shows them with cycle=null, which is the honest thing to draw rather than a
// derived table that would look authoritative. What IS proven for all five here: heading, card art,
// element glyph/colour, and whether the authored-copy blocks appear (#237).
const WOOD_YANG: Record<'male' | 'female', ElementCycleRow> = {
  male: {
    power: 'YANG',
    friend: 'WOOD',
    work: 'FIRE',
    career: 'METAL',
    fortune: 'EARTH',
    spouse: 'EARTH',
    supporter: 'WATER',
  },
  female: {
    power: 'YANG',
    friend: 'WOOD',
    work: 'FIRE',
    career: 'METAL',
    fortune: 'EARTH',
    spouse: 'METAL', // ← the one column gender changes. This is why a null gender may not be guessed.
    supporter: 'WATER',
  },
}

// The real body of POST /api/bazi/element-summary, pasted from goo's live call on #233
// (birthDate 1995-08-15 08:30 male → ธาตุดิน). Kept verbatim, long strings and all: the point of
// having it here is to see what the SERVICE says on the screen, not what the Figma frame wished for.
// Figma drew three short one-line traits; the service returns two long paragraphs and puts a label
// on each advice item. Those are different layout problems.
const REAL_SUMMARY = {
  elementTh: 'ดิน',
  tagline: 'สัญลักษณ์แห่งความมั่นคงและความน่าเชื่อถือ คุณคือรากฐานที่ผู้คนพึ่งพิงได้',
  traits: [
    'เป็นคนจงรักภักดี ซื่อสัตย์ รอบคอบ น่าเชื่อถือ รักษาคำพูด ใจกว้าง พึ่งพาได้ หนักแน่นและมั่นคงในความคิด',
    'รักอิสระ มักทำงานคนเดียว ไม่ชอบพึ่งพาผู้อื่น เงียบขรึมแต่ลงมืออย่างแม่นยำ',
  ],
  advice: [
    {
      key: 'talent',
      label: 'การใช้จุดแข็ง',
      text: 'ใช้พรสวรรค์กับงานที่ต้องความน่าเชื่อถือ บริหารทรัพย์สิน หรืองานที่ต้องดูแลคนอื่นในระยะยาว',
    },
    {
      key: 'health',
      label: 'การดูแลตัวเอง',
      text: 'ดูแลม้าม/กระเพาะ/ระบบย่อยอาหาร — กินเป็นเวลา เคี้ยวช้า และเลี่ยงอาหารเย็นจัด',
    },
  ],
}

const ELEMENT_TH: Record<string, string> = {
  wood: 'ไม้',
  metal: 'ทอง',
  fire: 'ไฟ',
  earth: 'ดิน',
  water: 'น้ำ',
}

// Paths are BUILT, never typed: buildMascotPaths owns the (นักษัตร, ธาตุ) filename convention, so a
// preview that hand-wrote them could drift from the 60 real files without anything failing.
function previewSource(
  elementParam: string,
  gender: string,
  noCycle: boolean,
  withSummary: boolean,
): ElementResultSource | null {
  const th = ELEMENT_TH[elementParam] ?? ELEMENT_TH.wood
  const mascot = buildMascotPaths('ชวด', th)
  if (!mascot) return null
  const cycle =
    noCycle || elementParam !== 'wood' ? null : WOOD_YANG[gender === 'female' ? 'female' : 'male']
  return { mascot, cycle, summary: withSummary ? REAL_SUMMARY : null }
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2FirstRunPreview() {
  const q = useRouter().query
  const step = (q.step as string) || 'intent'

  const goalParam = (q.goal as string) || 'health'
  const [goal, setGoal] = useState<GoalId | null>(goalParam === 'none' ? null : (goalParam as GoalId))
  const [consent, setConsent] = useState(q.consent === '1')

  if (step === 'pdpa') {
    return (
      <PdpaConsentScreen
        consent={consent}
        onConsentChange={setConsent}
        onBack={() => undefined}
        onAccept={() => window.alert('accept()')}
      />
    )
  }

  if (step === 'element') {
    const source = previewSource(
      ((q.element as string) || 'wood').toLowerCase(),
      ((q.gender as string) || 'male').toLowerCase(),
      q.cycle === 'none',
      q.summary === 'real',
    )
    // buildMascotPaths returns null on an unknown นักษัตร/ธาตุ. Say so instead of rendering a screen
    // with a broken image — a preview that fails quietly is worse than no preview.
    if (!source) return <p style={{ padding: 24 }}>unknown element: {String(q.element)}</p>
    return (
      <ElementResultScreen
        source={source}
        onBack={() => undefined}
        onReadFull={() => window.alert('readFull()')}
        onGoHome={() => window.alert('goHome()')}
      />
    )
  }

  return (
    <IntentCheckScreen
      selected={goal}
      onSelect={setGoal}
      onBack={() => undefined}
      onNext={() => window.alert('next()')}
    />
  )
}

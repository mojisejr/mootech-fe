// Figma Free-2 375:13285 `promo-personal-calendar` — the TALL upsell that stands in for the paid sections
// on the day-detail screen. Free-2 shows it; Paid-2 does not (and Paid-2 has no อัพเกรด pill either).
//
// It replaces, for a free member: โหมดแอดวานซ์ · ความเข้ากันรายด้าน · คำทำนายรายด้าน (+ the advanced-only
// sections those gate). Everything else on the screen — score card, ทิศ สีมงคล, เวลามงคล — free still gets.
//
// ONE NUMBER, NOT TWO (ฟีม 2026-08-04, คำถาม H): Figma writes 57% in the sentence and 75% in the left tile
// on the same card. Ruled a drift — both bind to the SAME day percent. Two different figures for one day on
// one card reads as a bug to the person we are asking for money.
//
// The CTA is a <span>, not a <button> (ฟีม, คำถาม E): payment v2 does not exist yet, so there is nothing to
// navigate to. Same call as the อัพเกรด pill in AppHeader — a control that looks pressable and does nothing
// is worse than one that never invited the press. Logged as A2; turning it into a Link is a one-line change.
import Image from 'next/image'
import Link from 'next/link'
import { SHOP_HREF } from '@/features/v2-shop/upgrade-cta'
import { percentText } from '../percent-display'

// Figma places six decorations on the card. Positions here are the LEAF box (Figma reports the bounding box
// of the already-rotated leaf, so the leaf's own left/top is derived from the centre), and the rotation is
// handed to the float via --sprite-rot exactly like CompatResultHero does — the base transform must live
// outside the keyframe or reduced-motion would snap every sprite to 0deg.
// ANCHOR, not coordinate. Figma hands out absolute `left` values measured on a 361-wide frame, and pasting
// them in makes the decorations stick to the LEFT edge while the card is fluid — so at 320 the whole
// top-right cluster slid past the card's right edge and got clipped away (5 of 6 gone), and at 430+ it
// drifted inward leaving the corner bare. Measured, not guessed: the metal sprite's gap to the right edge
// read −61 / 12 / 49 / 67 px at 320 / 393 / 430 / 768.
//
// This is the SAME bug-class as the Mate AI button (#166) — a Figma coordinate treated as a layout rule.
// The month promo card escaped it only because ฟีม's width ruling forced me to think about the right edge
// there; nothing forced it here, so the lesson did not carry across two cards in the same PR.
//
// So each decoration declares which edge it belongs to. The corner cluster hugs the RIGHT; the flame hugs
// the LEFT (it sits on the CTA's left end). At 361 the rendered positions are identical to before.
type Sprite = { key: string; src: string; anchor: 'left' | 'right'; x: number; top: number; w: number; h: number; rot: number }

// PAINT ORDER IS PART OF THE DESIGN. Figma interleaves the six decorations with the content rather than
// stacking them all underneath: 13176 (the Mu) and 13217 (wood) are drawn BEFORE the copy, and 13196
// (fire) · 13260 (metal) · 13281 (earth) · 13239 (water) are drawn AFTER it. The one that shows is the
// fire: it sits ON TOP of the lime CTA's left end. Putting all six in one layer behind the content hid it
// completely — the assertions were still green, the picture was not.
const SPRITES_BEHIND: Sprite[] = [
  { key: 'wood', src: '/images/v2/compat/sprite-wood.png', anchor: 'right', x: 57.518, top: 105.301, w: 20.661, h: 25.826, rot: 10.24 },
]

const SPRITES_FRONT: Sprite[] = [
  { key: 'fire', src: '/images/v2/compat/sprite-fire.png', anchor: 'left', x: 49.355, top: 203.936, w: 47.844, h: 59.806, rot: 10.24 },
  { key: 'metal', src: '/images/v2/compat/sprite-metal.png', anchor: 'right', x: 14.688, top: 82.9, w: 18.784, h: 23.48, rot: -13.789 },
  { key: 'earth', src: '/images/v2/compat/sprite-earth.png', anchor: 'right', x: 82.823, top: 103.586, w: 13.96, h: 17.45, rot: 5.094 },
  { key: 'water', src: '/images/v2/compat/sprite-water.png', anchor: 'right', x: 77.819, top: 117.668, w: 15.196, h: 18.995, rot: -13.789 },
]

function SpriteImg({ s }: { s: Sprite }) {
  return (
    <img
      data-testid={`calendar-upsell-sprite-${s.key}`}
      src={s.src}
      alt=""
      className="v3-float absolute object-cover"
      style={{ [s.anchor]: s.x, top: s.top, width: s.w, height: s.h, ['--sprite-rot' as string]: `${s.rot}deg` }}
    />
  )
}

// 375:13176 — the Mu mascot, same crop the navbar uses (h 113.07% / w 100.05%, nudged up-left), so it is
// kept as its own block instead of being flattened into the object-cover list above.
const MU = { right: 12.738, top: 50.166, w: 75.39, h: 92.307, rot: 10.638 }

export function PersonalCalendarUpsell({ percent, testId = 'calendar-upsell' }: { percent: number; testId?: string }) {
  return (
    <section
      data-testid={testId}
      className="relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-[22px] bg-v3-sapphire p-[18px] font-ibm"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* #555 — กรอบน้ำเงินรอบมาสคอตที่ฟีมเจอ = ขอบตัดของภาพ: เดิมกล่องนี้ overflow-hidden แล้วดันรูป
            เกิน 113% ด้วย offset ติดลบ ทำให้ขอบภาพถูกหั่นเป็นเส้นตรงเห็นบนพื้น sapphire — ตอนนี้ให้รูป
            อยู่ในกล่องพอดี (object-contain ไม่ครอบ) สไปรต์ทั้งตัวลอยได้ไม่มีรอยตัด */}
        <div data-testid="calendar-upsell-mu" className="v3-float absolute" style={{ right: MU.right, top: MU.top, width: MU.w, height: MU.h, ['--sprite-rot' as string]: `${MU.rot}deg` }}>
          <Image src="/images/v2/mascot/01-nav.png" alt="" width={76} height={105} className="h-full w-full object-contain" />
        </div>
        {SPRITES_BEHIND.map((s) => (
          <SpriteImg key={s.key} s={s} />
        ))}
      </div>

      <div className="relative z-10 flex w-full flex-col items-center gap-3">
        <p data-testid="calendar-upsell-headline" className="w-full text-center text-[20px] font-bold leading-7 text-white">
          ไม่ใช่ทุกวัน จะเป็นวันของคุณ
        </p>
        <div className="w-full text-center text-[12px] font-normal leading-[18px] text-white">
          <p>วันที่ {percentText(percent)}% นี้ คือค่าเฉลี่ยของ “ทุกคน”</p>
          <p>แต่ดวงคุณอาจอ่านวันนี้ได้อีกแบบ</p>
          <p>เช็กจากปาจื้อของคุณเอง</p>
        </div>

        <div className="flex w-full gap-2">
          <div data-testid="calendar-upsell-tile-free" className="flex flex-1 flex-col gap-0.5 overflow-hidden rounded-[14px] bg-v3-slate-muted px-3 py-2.5 text-white">
            <p className="text-[11px] font-normal">ปฏิทินกลาง (ฟรี)</p>
            <p className="text-[17px] font-bold">{percentText(percent)}%</p>
            <p className="text-[11px] font-normal">กำลังดิถีของวัน</p>
          </div>
          <div data-testid="calendar-upsell-tile-mine" className="flex flex-1 flex-col gap-0.5 overflow-hidden rounded-[14px] bg-v3-lemon-chiffon px-3 py-2.5">
            <p className="text-[11px] font-normal text-v3-text-body">ปฏิทินของคุณ</p>
            <p className="text-[17px] font-bold text-v3-sapphire">?</p>
            <p className="text-[11px] font-normal text-v3-text-body">ปลดล็อกเพื่อดู</p>
          </div>
        </div>

        {/* ฟีม 2026-08-06 — the riskiest of the five: a full-width lime pill under a price line reads as
            "pay here", so a silent tap reads as a broken checkout, not as an unbuilt feature. */}
        {/* #359 — the destination exists now. ฟีม 2026-08-06 called this "the riskiest of the five": a
            full-width lime pill under a price line reads as "pay here", so a silent tap read as a broken
            checkout. Announcing was the stopgap; the pricing screen is the answer. */}
        <Link
          href={SHOP_HREF}
          data-testid="calendar-upsell-cta"
          aria-label="เปิดการใช้งานปฏิทินเฉพาะฉัน"
          className="flex items-center justify-center rounded-full bg-v3-lime px-6 py-2 text-[14px] font-semibold uppercase leading-5 text-v3-sapphire"
        >
          เปิดการใช้งานปฏิทินเฉพาะฉัน
        </Link>

        <p className="w-full text-center text-[14px] font-normal leading-[22px] text-white">เริ่มต้น ฿99/เดือน · ยกเลิกได้ทุกเมื่อ</p>
      </div>

      {/* the four Figma draws AFTER the copy — the fire lands on the CTA's left end, in front of the lime */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {SPRITES_FRONT.map((s) => (
          <SpriteImg key={s.key} s={s} />
        ))}
      </div>
    </section>
  )
}

export default PersonalCalendarUpsell

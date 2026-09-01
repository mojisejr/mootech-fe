import React from 'react'
import { HabitCard } from './HabitCard'
import { comingSoonHrefById } from '@/features/v2-service/services'

// ── Zone 6 — เรียนปาจื่อ (mindful-moments-section · Figma 375:14147) ──────────────────────────────────
// Reuses the shared <HabitCard/> (Figma 375:14151 === Zone 4's 333:6889 — pixel-identical card, motion and all).
// Copy + price refreshed 2026-09-01 (ฟีม, issue #563): 499 is the real selling price, and this is a
// standalone product (course + book), not a pack. The CTA is UNCHANGED on purpose — there is no real
// product in the system yet, so making the price purchasable is the money lane (#382 / #278), not this.
// Zone 6 differs from Zone 4 ONLY in: the header copy, a 2-line card title (text box 140), a **tertiary** CTA
// (ดูรายละเอียดเพิ่มเติม, 171×36), and NO 3-card row / no bottom CTA. Everything visual about the card itself —
// gradient, both mascots, the CSS book-frame, the 3-piece cohort motion — comes from HabitCard unchanged.
export function PajeuSection() {
  return (
    <section className="mb-6 flex w-full flex-col items-center gap-2">
      {/* section-header (Figma 375:14148 — left-aligned, 361 wide, 84 tall) */}
      <div className="flex w-full flex-col gap-2 pb-2">
        <h2 className="text-xl font-bold leading-7 text-v3-navy">เรียนอ่านดวง</h2>
        <p className="text-sm font-medium leading-5 text-v3-text-body">
          {/* Both lines are authored, not wrapped: Thai has no word spaces, so a soft wrap can break
              mid-word. The split point is after "ด้วยตัวเอง" — the end of the first clause. */}
          ปลดล็อควิชาทำนายขั้นสูง วิเคราะห์ดวงชะตาได้ด้วยตัวเอง
          <br />
          เข้าใจดวง ใช้เป็น วางแผนชีวิตได้สิบ ๆ ปี
        </p>
      </div>
      {/* habit-card (Figma 375:14151) — shared component; title is 2 lines, CTA is tertiary. No 3-card row. */}
      <HabitCard
        // landscape 569:436. 134px looked right in isolation and cost the CTA its single line — "ดูรายละเอียด
        // เพิ่มเติม" wrapped, which the BEFORE shot proves it did not. 112 gives the copy back the 175px it
        // had. The card drops its 40px left inset (no mascot overhangs it now), which is what pays for the
        // landscape width without taking it from the text.
        art={{ src: '/images/v2/home/%E0%B9%80%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%99%E0%B8%9B%E0%B8%B2%E0%B8%88%E0%B8%B7%E0%B9%88%E0%B8%AD.webp', w: 112, h: 85.8 }}
        // its 水 is full-body, centre-frame and nearly the same size as the card's own, which reads as the
        // same picture pasted twice rather than as a composition (ฟีม, from the real route).
        showMascots={false}
        title={
          <>
            เรียน Bazi ออนไลน์
            <br />
            ในงบ 499 บาท
          </>
        }
        desc={
          <>
            {/* Every break here is AUTHORED. ฟีม's copy is two sentences, but neither fits one line on
                this card, and the engine's own Thai line-breaking picked splits that read wrong: at 393
                it broke "บทเรียน" into "บท / เรียน", and at 320 it broke "ต่อยอด" into "ต่อย / อด" —
                which is a different word. A NBSP does NOT fix this: the browser breaks Thai by its own
                dictionary, not at ASCII spaces, and swapping the space changed nothing in the frame
                (measured, both renders identical). Hard breaks are the only thing it obeys.
                Words are ฟีม's, unchanged — only the line count is mine. */}
            คอร์สเรียนออนไลน์
            <br />
            15 บทเรียน
            <br />
            ปูพื้นฐาน
            <br />
            พร้อมต่อยอดความรู้
          </>
        }
        cta={{ variant: 'tertiary', label: 'ดูรายละเอียดเพิ่มเติม', href: comingSoonHrefById('pajeu') }}
      />
    </section>
  )
}

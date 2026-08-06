import React from 'react'
import { HabitCard } from './HabitCard'

// ── Zone 6 — เรียนปาจื่อ (mindful-moments-section · Figma 375:14147) ──────────────────────────────────
// Reuses the shared <HabitCard/> (Figma 375:14151 === Zone 4's 333:6889 — pixel-identical card, motion and all).
// Zone 6 differs from Zone 4 ONLY in: the header copy, a 2-line card title (text box 140), a **tertiary** CTA
// (ดูรายละเอียดเพิ่มเติม, 171×36), and NO 3-card row / no bottom CTA. Everything visual about the card itself —
// gradient, both mascots, the CSS book-frame, the 3-piece cohort motion — comes from HabitCard unchanged.
export function PajeuSection() {
  return (
    <section className="mb-6 flex w-full flex-col items-center gap-2">
      {/* section-header (Figma 375:14148 — left-aligned, 361 wide, 84 tall) */}
      <div className="flex w-full flex-col gap-2 pb-2">
        <h2 className="text-xl font-bold leading-7 text-v3-navy">เรียนปาจื่อ</h2>
        <p className="text-sm font-medium leading-5 text-v3-text-body">
          ปลดล็อกพลังทำนายขั้นสูง วิเคราะห์ดวงชะตาแบบเจาะลึก
          <br />
          รู้ก่อน เตรียมพร้อมก่อน ด้วยระบบ AI ระดับเซียน
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
            เรียนปาจื่อออนไลน์
            <br />
            ในงบ 265 บาท
          </>
        }
        desc={
          <>
            วิเคราะห์ดวงชะตาเชิงลึก
            <br />
            รวบรวมเป็นหนังสือส่วนตัว
          </>
        }
        cta={{ variant: 'tertiary', label: 'ดูรายละเอียดเพิ่มเติม' }}
      />
    </section>
  )
}

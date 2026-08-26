// #451 ตัว A — ฟันของ `setupFiles` เอง
//
// 🔴 MUTANT: ถอด `setupFiles: ['scripts/vitest-setup-rtl.ts']` ออกจาก vitest.config.mts
//            → "ไม่มีของค้างจากเทสต์ก่อนหน้า" ต้องแดงทันที
//
// 🔑 ทำไมเทสต์นี้ต้องอยู่ในรีโป ไม่ใช่สคริปต์ที่รันสดแล้วลบ (ตู๋ #475):
// สิ่งที่มันเฝ้าคือ "บรรทัดหนึ่งบรรทัดใน config ยังต่อสายอยู่ไหม" — บรรทัดที่หายไปเงียบได้ทุกเมื่อ
// และเมื่อมันหาย ทุกอย่างยัง "เขียว" เหมือนเดิม เพราะอาการปลายทางคือ flake ที่โผล่ 1 ใน 6 รอบ
//
// ⚠️ ไฟล์นี้ต้องอยู่ใน include list ของ vitest.config.mts — ถ้าลืม vitest ตอบ "No test files found"
// ซึ่งอ่านออกมาเหมือน "ไม่มีอะไรผิด" (ตู๋ชนกำแพงนี้เองตอนตรวจ · ตระกูลเดียวกับบั๊กที่ใบนี้ถืออยู่)
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

const MARK = 'rtl-cleanup-contract-probe'

describe('#451 ตัว A — RTL auto-cleanup ต้องยิงระหว่างเทสต์', () => {
  it('ปลูกของทิ้งไว้หนึ่งชิ้น (ขั้นเตรียม ไม่ใช่ข้อพิสูจน์)', () => {
    render(<div data-testid={MARK}>x</div>)
    expect(document.body.querySelectorAll(`[data-testid="${MARK}"]`)).toHaveLength(1)
  })

  it('🔴 ไม่มีของค้างจากเทสต์ก่อนหน้า', () => {
    // ถ้า cleanup ไม่ยิง ค่านี้เป็น 1 — ซึ่งคือสภาพของรีโปนี้ตั้งแต่ไฟล์เทสต์แรกจนถึง #475
    expect(document.body.querySelectorAll(`[data-testid="${MARK}"]`)).toHaveLength(0)
  })
})

// 2026-09-12 (ผู้ใช้/ซินแส) — สองความจริงใหม่บนการ์ด "ประตู · เทพ · ทิศ · ประจำวัน":
//
// A. สีพื้นของช่องประตู = "ธาตุของทิศ" (คงที่), และเข้มขึ้น (bgStrong) + ป้าย ⚡ เมื่อธาตุ ประตู+เทพ+ทิศ ตรงกัน
//    ทั้งสาม. คนละมิติกับ "ดี/ร้าย" (ตำราไม่มีสำหรับ 8 ประตู). ทดสอบ cellElementTint แบบ pure.
// B. ช่องค้นหาบนตารางประตู: พิมพ์คำที่ตรง keyword → เน้นช่อง (data-match) + บอกทิศ; พิมพ์คำมั่ว → "ไม่พบ" + ชิป
//    แนะนำ (คลิกชิป = ค้นด้วยคำนั้น).
//
// .tsx เพื่อให้ vitest.config include เห็น (เลนเก่า scripts/*.test.ts จะไม่รัน)
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { cellElementTint, ELEMENT_TINT } from '@/features/v2-calendar/components/day-detail/gate-compass'
import { EightGates } from '@/features/v2-calendar/components/day-detail/EightGates'
import type { DayDetailGate } from '@/features/v2-calendar/types'

afterEach(cleanup)

describe('A · สีตามธาตุของทิศ + ความเข้มเมื่อพลังตรงกัน (cellElementTint)', () => {
  it('พื้นช่องเป็นสีธาตุของทิศ — E/SE=ไม้(เขียว), S=ไฟ(แดง), N=น้ำ', () => {
    expect(cellElementTint('E', '休', '天').element).toBe('ไม้')
    expect(cellElementTint('SE', '休', '天').element).toBe('ไม้')
    expect(cellElementTint('S', '休', '天').element).toBe('ไฟ')
    expect(cellElementTint('N', '休', '天').element).toBe('น้ำ')
    // สีตรงกับตาราง ELEMENT_TINT ของธาตุนั้น
    expect(cellElementTint('S', '休', '天').ink).toBe(ELEMENT_TINT['ไฟ'].ink)
  })

  it('strong=true + ใช้ bgStrong เมื่อธาตุ ประตู+เทพ+ทิศ ตรงกันทั้งสาม', () => {
    // ทิศ N=น้ำ, ประตู 休=น้ำ, เทพ 玄=น้ำ → ตรงหมด
    const strong = cellElementTint('N', '休', '玄')
    expect(strong.strong).toBe(true)
    expect(strong.bg).toBe(ELEMENT_TINT['น้ำ'].bgStrong)
  })

  it('strong=false + ใช้ bg ปกติ เมื่อไม่ตรงครบสาม', () => {
    // ทิศ N=น้ำ, ประตู 景=ไฟ (ไม่ตรง) → ไม่ strong
    const weak = cellElementTint('N', '景', '玄')
    expect(weak.strong).toBe(false)
    expect(weak.bg).toBe(ELEMENT_TINT['น้ำ'].bg)
  })
})

// ทิศของประตูวันนี้: 開→E (keyword มี "เริ่มต้นกิจการ"), 休→N, 生→SE ...
const GATES: DayDetailGate[] = [
  { name: '開', direction: 'E', meaning: 'เปิด', keywords: ['โอกาสใหม่', 'เริ่มต้นกิจการ', 'ค้าขายเจรจา'], deity: '天' },
  { name: '休', direction: 'N', meaning: 'พักผ่อน', keywords: ['พักผ่อนฟื้นฟู', 'ขอความช่วยเหลือ'], deity: '玄' },
  { name: '生', direction: 'SE', meaning: 'เกิด', keywords: ['เงินทองงอกเงย', 'ลงทุน'], deity: '符' },
]

describe('B · ช่องค้นหาบนตารางประตู', () => {
  it('คำที่ตรง keyword → เน้นช่องของประตูนั้น (data-match) + บอกทิศ', () => {
    render(<EightGates gates={GATES} />)
    const input = screen.getByLabelText('ค้นหาว่าควรไปทิศไหน')
    fireEvent.change(input, { target: { value: 'เริ่มต้นกิจการ' } })
    // ช่องทิศ E (ประตู 開) ต้องถูกเน้น
    const cellE = document.querySelector('[data-testid="gate-cell"][data-dir="E"]')
    expect(cellE?.getAttribute('data-match')).toBe('1')
    // บรรทัดผลบอกทิศ
    expect(screen.getByTestId('gate-search-hit').textContent).toContain('ตะวันออก')
  })

  it('วลีที่คนมักถาม → ประตูที่ตรงเป็น "แนะนำ" (data-rank=top) + บอกทิศ ("ขอเงิน" → 生 ทิศ SE)', () => {
    render(<EightGates gates={GATES} />)
    const input = screen.getByLabelText('ค้นหาว่าควรไปทิศไหน')
    fireEvent.change(input, { target: { value: 'ขอเงิน' } }) // ตรงวลี GATE_PHRASES ของ 生
    const cellSE = document.querySelector('[data-testid="gate-cell"][data-dir="SE"]')
    expect(cellSE?.getAttribute('data-match')).toBe('1')
    expect(cellSE?.getAttribute('data-rank')).toBe('top') // น้ำหนักไปทาง 生 = แนะนำ
    const hit = screen.getByTestId('gate-search-hit').textContent
    expect(hit).toContain('แนะนำ')
    expect(hit).toContain('อาคเนย์')
  })

  it('คำมั่วที่ไม่ตรง key → โชว์ "ไม่พบ" + ชิปวลีที่คนมักถาม, คลิกชิปแล้วค้นด้วยคำนั้น', () => {
    render(<EightGates gates={GATES} />)
    const input = screen.getByLabelText('ค้นหาว่าควรไปทิศไหน') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zxcvbnmqwerty' } }) // ล้วน latin — ไม่แชร์คำกับความหมายไทยใด
    expect(screen.getByTestId('gate-search-empty')).toBeTruthy()
    // ชิปแนะนำ = วลีเด่นของแต่ละประตู (GATE_PHRASES) — 開 = "เปิดบริษัท"
    const chip = screen.getByRole('button', { name: 'เปิดบริษัท' })
    fireEvent.click(chip)
    expect(input.value).toBe('เปิดบริษัท')
    expect(screen.getByTestId('gate-search-hit')).toBeTruthy()
  })

  it('คำยาว/หลายคำที่แชร์แค่คำทั่วไป (ความ/ชีวิต) → ไม่ตีตรา "แนะนำ" ทุกทิศ (แก้บั๊กเลือกหมด)', () => {
    render(<EightGates gates={GATES} />)
    const input = screen.getByLabelText('ค้นหาว่าควรไปทิศไหน')
    fireEvent.change(input, { target: { value: 'อยากมีความสุขในชีวิต' } })
    // แชร์แค่คำทั่วไป (คะแนน 20) → ไม่ถึงเกณฑ์ "จับใจความได้จริง" → ไม่มีช่องไหนเป็น top
    expect(document.querySelectorAll('[data-testid="gate-cell"][data-rank="top"]').length).toBe(0)
    expect(screen.getByTestId('gate-search-empty')).toBeTruthy()
  })

  it('เติมวลีสุขภาพ → "รักษาอาการป่วย" จับใจความเข้าประตู 生 (การดูแลสุขภาพ) ได้', () => {
    render(<EightGates gates={GATES} />)
    const input = screen.getByLabelText('ค้นหาว่าควรไปทิศไหน')
    fireEvent.change(input, { target: { value: 'รักษาอาการป่วย' } })
    const cellSE = document.querySelector('[data-testid="gate-cell"][data-dir="SE"]') // 生 อยู่ SE ใน fixture
    expect(cellSE?.getAttribute('data-rank')).toBe('top')
    expect(screen.getByTestId('gate-search-top').textContent).toContain('อาคเนย์')
  })

  it('เน้น 3 ประตูมงคล (開/生/景) → ค้นเจอประตูมงคลติดป้าย "มงคล" ("ขอเงิน" → 生)', () => {
    render(<EightGates gates={GATES} />)
    const input = screen.getByLabelText('ค้นหาว่าควรไปทิศไหน')
    fireEvent.change(input, { target: { value: 'ขอเงิน' } }) // 生 = ประตูมงคล (การเงิน)
    const top = screen.getByTestId('gate-search-top')
    expect(top.getAttribute('data-auspicious')).toBe('1')
    expect(top.textContent).toContain('มงคล')
  })

  it('input ว่าง → ไม่มีช่องไหนถูกเน้น (ไม่ active)', () => {
    render(<EightGates gates={GATES} />)
    expect(document.querySelector('[data-testid="gate-cell"][data-match="1"]')).toBeNull()
    expect(screen.queryByTestId('gate-search-empty')).toBeNull()
  })
})

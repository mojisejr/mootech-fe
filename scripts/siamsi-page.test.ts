// scripts/siamsi-page.test.ts — ไพ่เซียมซีเคี้ยงคุง 80 ใบ หน้าในแอป (ซินแสนุ้ย 2026-10-15) — สร้างไว้แต่ยังปิด
//   SP1 BFF แปลงผล engine {card, summary} → รูปแบบ CardReadingScreen {cards:[1 ใบ], engineProse, llmProse, qi}
//   SP2 การ์ดเมนูซ่อนอยู่ (hiddenUntilArt) · มี coming-soon ให้หน้า ON_HOLD ส่งไป
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/config', () => ({ default: () => ({ publicRuntimeConfig: {}, serverRuntimeConfig: {} }) }))

describe('ไพ่เซียมซีเคี้ยงคุง (หน้าในแอป — ยังปิด)', () => {
  it('SP1 BFF แปลงผล engine เป็นรูปแบบหน้าเปิดไพ่', async () => {
    const { toCardReading } = await import('../pages/api/fortune/siamsi')
    const out = toCardReading({
      card: { no: 9, name: 'เมฆบังพระจันทร์', theme: 'ความคลุมเครือ', situation: 'สถาน', caution: 'ระวัง', advice: 'แนะนำ', imageUrl: 'https://x/siamsi-cards/cards/9.jpg' },
      summary: 'สรุปจาก AI',
      qi: { source: 'free', cost: 0 },
    }) as { cards: Array<Record<string, unknown>>; engineProse: string; llmProse: string; qi: unknown }
    expect(out.cards).toHaveLength(1)
    expect(out.cards[0]).toMatchObject({ no: 9, name: 'เมฆบังพระจันทร์', keyword: 'ความคลุมเครือ', meaning: 'สถาน', imageUrl: 'https://x/siamsi-cards/cards/9.jpg' })
    expect(out.engineProse).toContain('ข้อควรระวัง: ระวัง')
    expect(out.engineProse).toContain('คำแนะนำ: แนะนำ')
    expect(out.llmProse).toBe('สรุปจาก AI')
    expect(out.qi).toEqual({ source: 'free', cost: 0 })
    // error จาก engine (ไม่มี card) → ส่งต่อตามเดิม
    expect(toCardReading({ error: { message: 'quota' } })).toEqual({ error: { message: 'quota' } })
  })

  it('SP2 การ์ดเมนูซ่อนอยู่ + มีหน้า coming-soon', async () => {
    const { SERVICES, VISIBLE_SERVICES, comingSoonHrefById } = await import('@/features/v2-service/services')
    expect(SERVICES.some((s) => s.id === 'siamsi-kiangkung')).toBe(true)
    expect(VISIBLE_SERVICES.some((s) => s.id === 'siamsi-kiangkung')).toBe(false)
    expect(comingSoonHrefById('siamsi-kiangkung')).toBeTruthy()
  })
})

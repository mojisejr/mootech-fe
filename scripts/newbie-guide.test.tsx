// scripts/newbie-guide.test.tsx — เส้นทางมือใหม่ (ไกด์สอนเล่นแบบเกม · เอ็ม 2026-10-13)
//   NG1 การ์ดหน้าหลัก: 0/6 + ภารกิจถัดไป = ภารกิจแรก (ลิงก์มี ?guide=)
//   NG2 เข้าหน้าของภารกิจ → นับผ่าน → การ์ดขยับเป็น 1/6 และภารกิจถัดไปเปลี่ยน
//   NG3 มาจากไกด์ (?guide=<id>) → มาสคอตอธิบายหน้า · เข้าเองไม่โชว์
//   NG4 กดซ่อน → การ์ดหาย (จำไว้)
//   NG5 questForPath จับ path ลูกของภารกิจ
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'

let route: { pathname: string; query: Record<string, string>; isReady: boolean; push: ReturnType<typeof vi.fn> } = { pathname: '/v2', query: {}, isReady: true, push: vi.fn() }
vi.mock('next/router', () => ({ useRouter: () => route }))

import { GuideCard } from '@/features/v2-guide/GuideCard'
import { GuideCoach } from '@/features/v2-guide/GuideCoach'
import { GUIDE_QUESTS, GUIDE_TOTAL, questForPath } from '@/features/v2-guide/quests'

beforeEach(() => { localStorage.clear(); route = { pathname: '/v2', query: {}, isReady: true, push: vi.fn() } })
afterEach(() => cleanup())

describe('เส้นทางมือใหม่', () => {
  it('NG1 การ์ด: 0/N + ภารกิจถัดไป = ภารกิจแรก', () => {
    render(<GuideCard />)
    expect(screen.getByTestId('guide-progress').textContent).toBe(`0/${GUIDE_TOTAL}`)
    const next = screen.getByTestId('guide-next')
    expect(next.textContent).toContain(GUIDE_QUESTS[0].title)
    expect(next.getAttribute('href')).toBe(`${GUIDE_QUESTS[0].href}?guide=${GUIDE_QUESTS[0].id}`)
  })

  it('NG2 เข้าหน้าของภารกิจ → นับผ่าน → การ์ดเป็น 1/N', () => {
    route = { ...route, pathname: GUIDE_QUESTS[0].href }
    render(<><GuideCoach /><GuideCard /></>)
    expect(screen.getByTestId('guide-progress').textContent).toBe(`1/${GUIDE_TOTAL}`)
    expect(screen.getByTestId('guide-next').textContent).toContain(GUIDE_QUESTS[1].title)
  })

  it('NG3 มาจากไกด์ → มาสคอตอธิบาย · เข้าเองไม่โชว์', () => {
    const q = GUIDE_QUESTS[2]
    route = { ...route, pathname: q.href }
    const { unmount } = render(<GuideCoach />)
    expect(screen.queryByTestId('guide-coach')).toBeNull()
    unmount()
    route = { ...route, pathname: q.href, query: { guide: q.id } }
    render(<GuideCoach />)
    expect(screen.getByTestId('guide-coach').textContent).toContain(q.title)
    fireEvent.click(screen.getByTestId('guide-coach-next'))
    expect(route.push).toHaveBeenCalledWith(`${GUIDE_QUESTS[0].href}?guide=${GUIDE_QUESTS[0].id}`)
  })

  it('NG4 กดซ่อน → การ์ดหายและจำไว้', () => {
    const { unmount } = render(<GuideCard />)
    act(() => { fireEvent.click(screen.getByTestId('guide-hide')) })
    expect(screen.queryByTestId('guide-card')).toBeNull()
    unmount()
    render(<GuideCard />)
    expect(screen.queryByTestId('guide-card')).toBeNull()
  })

  it('NG5 questForPath จับ path ลูก', () => {
    expect(questForPath('/v2/fortune/oracle')?.id).toBe('fortune')
    expect(questForPath('/v2/service/compatibility/colleague')?.id).toBe('compat')
    expect(questForPath('/v2/destinyx')).toBeUndefined()
    expect(questForPath('/v2')).toBeUndefined()
  })
})

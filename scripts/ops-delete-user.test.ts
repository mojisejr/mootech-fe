// scripts/ops-delete-user.test.ts — 2026-09-20: /ops ปุ่มลบบัญชี (ทำให้เป็น user ใหม่เพื่อเทสต์สมัคร LINE ซ้ำ).
// deleteUserIdentity ต้อง scoped ที่ user_id, ลบ 3 table (user_provider/subscription/user), นับแถวจริง,
// และ best-effort (table ใดพังไม่ทำให้ทั้งชุดล้ม).
import { describe, expect, it, vi } from 'vitest'

// กัน lib/db สร้าง postgres client จริงตอน import (DATABASE_URL อาจไม่มีใน test env)
vi.mock('@/lib/db', () => ({ db: {} }))

import { user, userProvider, memberSubscription } from '@/lib/db/schema'
import { deleteUserIdentity } from '../lib/ops/delete-user'

type Counts = { userProvider?: number; memberSubscription?: number; user?: number; throwOn?: 'userProvider' | 'memberSubscription' | 'user' }

function makeDb(counts: Counts) {
  const order: string[] = []
  const nameOf = (t: unknown): keyof Counts =>
    t === userProvider ? 'userProvider' : t === memberSubscription ? 'memberSubscription' : 'user'
  return {
    order,
    delete(table: unknown) {
      const name = nameOf(table)
      return {
        where() {
          return {
            async returning() {
              order.push(name)
              if (counts.throwOn === name) throw new Error('boom')
              const n = (counts[name] as number) ?? 0
              return Array.from({ length: n }, (_v, i) => ({ i }))
            },
          }
        },
      }
    },
  }
}

describe('deleteUserIdentity — ลบ identity แบบ scoped + best-effort', () => {
  it('ลบครบ 3 table, คืนจำนวนแถวตามจริง', async () => {
    const db = makeDb({ userProvider: 1, memberSubscription: 2, user: 1 })
    const r = await deleteUserIdentity('u-123', db as never)
    expect(r).toEqual({ userProvider: 1, memberSubscription: 2, user: 1 })
    expect(db.order).toEqual(['userProvider', 'memberSubscription', 'user'])
  })

  it('table หนึ่งพัง → table อื่นยังลบต่อ (best-effort), ตัวที่พังนับ 0', async () => {
    const db = makeDb({ userProvider: 1, memberSubscription: 3, user: 1, throwOn: 'memberSubscription' })
    const r = await deleteUserIdentity('u-9', db as never)
    expect(r).toEqual({ userProvider: 1, memberSubscription: 0, user: 1 })
    // user ยังถูกลบแม้ subscription พังก่อนหน้า
    expect(db.order).toContain('user')
  })

  it('ไม่มีแถวให้ลบ → คืน 0 ทุก table (ไม่ throw)', async () => {
    const db = makeDb({})
    const r = await deleteUserIdentity('u-none', db as never)
    expect(r).toEqual({ userProvider: 0, memberSubscription: 0, user: 0 })
  })
})

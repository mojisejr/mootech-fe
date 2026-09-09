// บันทึก audit ทุก mutation ของ /ops (tier/QI/วันเกิด) — เงิน/สิทธิ์ต้องตามรอยได้ว่าใครทำอะไรกับใคร
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export async function logOpsAction(input: {
  adminUserId: string | null
  action: string
  targetUserId: string | null
  payload?: unknown
}): Promise<void> {
  try {
    await db.execute(
      sql`INSERT INTO "ops_audit_log" (id, admin_user_id, action, target_user_id, payload, created_at)
          VALUES (${randomUUID()}, ${input.adminUserId}, ${input.action}, ${input.targetUserId ?? null},
                  ${JSON.stringify(input.payload ?? {})}::jsonb, now())`,
    )
  } catch {
    /* audit best-effort — ต้องไม่ทำให้ action หลักล้ม */
  }
}

// PATCH /api/ops/tier — comp grant/revoke membership tier. gate → validate → apply → audit
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated, opsAdminUserId } from '@/lib/ops/gate'
import { validateTierEdit, applyTier } from '@/lib/ops/tier'
import { logOpsAction } from '@/lib/ops/audit'
import { resolveSubscription } from '@/lib/v2/subscription'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as Record<string, unknown>
  const checked = validateTierEdit({ userId: body.user_id, action: body.action, tierCode: body.tier_code, expireAt: body.expire_at })
  if (!checked.ok) return res.status(400).json({ error: 'invalid edit', reason: checked.reason })

  try {
    await applyTier(checked.edit)
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'apply failed' })
  }
  await logOpsAction({ adminUserId: opsAdminUserId(req), action: `tier:${checked.edit.action}`, targetUserId: checked.edit.userId, payload: checked.edit })
  return res.status(200).json({ ok: true, membership: await resolveSubscription(checked.edit.userId) })
}

// GET/PATCH /api/ops/packages (mootech-fe#377) — read the membership packages, and change PRICE / ON-SALE.
//
// 🔴 Gated by ops_access, re-checked HERE and not only in middleware (fail closed: no OPS_DASHBOARD_KEY ⇒
// isOpsAuthenticated is false ⇒ every request is refused, including reads). This is the first /ops route
// that WRITES, so the gate is checked before anything is parsed.
import type { NextApiRequest, NextApiResponse } from 'next'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { listPackages, validateEdit, applyEdit } from '@/lib/ops/packages'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isOpsAuthenticated(req)) return res.status(401).json({ error: 'Not authenticated' })

  if (req.method === 'GET') {
    return res.status(200).json({ packages: await listPackages() })
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as Record<string, unknown>
    const checked = validateEdit({
      packageCode: body.package_code,
      amountBaht: body.amount_baht,
      isActive: body.is_active,
    })
    if (!checked.ok) return res.status(400).json({ error: 'invalid edit', reason: checked.reason })

    const applied = await applyEdit(checked.edit)
    if (!applied) return res.status(404).json({ error: 'unknown package_code' })
    return res.status(200).json({ ok: true, packages: await listPackages() })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

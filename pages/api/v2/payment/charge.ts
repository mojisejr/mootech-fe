// POST /api/v2/payment/charge (mootech-fe#355) — card charge. Session-gated (under /api/v2, guarded by
// middleware + resolveSessionUserId). Body: { token, package_code }. The card number never reaches us
// (client tokenized via omise.js); user_id/amount/discount from the body are ignored.
import type { NextApiRequest, NextApiResponse } from 'next'
import { runChargeFlow } from '@/lib/payment/charge-flow'
import { omiseGateway } from '@/lib/payment/omise-gateway'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runChargeFlow(req, res, 'card', ({ amountSatang, token, email, orderId, packageCode }) =>
    omiseGateway.createCardCharge({ amountSatang, token: token as string, email, orderId, packageCode }),
  )
}

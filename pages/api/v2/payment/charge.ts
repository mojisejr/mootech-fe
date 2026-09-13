// POST /api/v2/payment/charge (mootech-fe#355) — card charge. Session-gated (under /api/v2, guarded by
// middleware + resolveSessionUserId). Body: { token, package_code }. The card number never reaches us
// (client tokenized via omise.js); user_id/amount/discount from the body are ignored.
import type { NextApiRequest, NextApiResponse } from 'next'
import { runChargeFlow } from '@/lib/payment/charge-flow'
import { selectGateway } from '@/lib/payment/select-gateway'

// The adapter is resolved PER REQUEST from PAYMENT_GATEWAY (select-gateway.ts) — never imported here —
// so a provider switch or a rollback is an env change, and a name this build does not know fails loud on
// the first charge instead of quietly charging through Omise.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runChargeFlow(req, res, 'card', ({ amountSatang, token, email, orderId, packageCode }) =>
    selectGateway().createCardCharge({ amountSatang, token: token as string, email, orderId, packageCode }),
  )
}

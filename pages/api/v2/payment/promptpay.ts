// POST /api/v2/payment/promptpay (mootech-fe#355) — PromptPay QR charge. Same session gate + server
// pricing as card; no card token. Returns the QR download_uri for the client to render.
import type { NextApiRequest, NextApiResponse } from 'next'
import { runChargeFlow } from '@/lib/payment/charge-flow'
import { selectGateway } from '@/lib/payment/select-gateway'

// Adapter resolved per request from PAYMENT_GATEWAY — see charge.ts and select-gateway.ts.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runChargeFlow(req, res, 'promptpay', ({ amountSatang, email, orderId }) =>
    selectGateway().createPromptPayCharge({ amountSatang, email, orderId }),
  )
}

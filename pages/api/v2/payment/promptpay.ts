// POST /api/v2/payment/promptpay (mootech-fe#355) — PromptPay QR charge. Same session gate + server
// pricing as card; no card token. Returns the QR download_uri for the client to render.
import type { NextApiRequest, NextApiResponse } from 'next'
import { runChargeFlow } from '@/lib/payment/charge-flow'
import { omiseGateway } from '@/lib/payment/omise-gateway'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runChargeFlow(req, res, 'promptpay', ({ amountSatang, email, orderId }) =>
    omiseGateway.createPromptPayCharge({ amountSatang, email, orderId }),
  )
}

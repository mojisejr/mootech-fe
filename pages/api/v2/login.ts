// MuMate v2 preview gate submit. POST { passkey } -> validate against V2_PREVIEW_KEY -> set the
// httpOnly cookie -> redirect back to /v2. Fail closed: V2_PREVIEW_KEY unset means this route always
// rejects (middleware also hides the whole /v2 surface in that case). Deliberately simpler than
// /api/ops/login: a single team-wide passkey, no per-user DB lookup / Discord ping.
import type { NextApiRequest, NextApiResponse } from 'next'
import { v2CookieHeader } from '@/lib/v2/gate'

function redirectWithError(res: NextApiResponse, reason: string) {
  res.writeHead(303, { Location: `/v2?gate_error=${encodeURIComponent(reason)}` })
  res.end()
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } })
    return
  }

  const key = process.env.V2_PREVIEW_KEY
  if (!key) {
    redirectWithError(res, 'unavailable')
    return
  }

  const passkey = typeof req.body?.passkey === 'string' ? req.body.passkey : ''
  if (passkey !== key) {
    redirectWithError(res, 'invalid')
    return
  }

  res.setHeader('Set-Cookie', v2CookieHeader(key))
  res.writeHead(303, { Location: '/v2' })
  res.end()
}

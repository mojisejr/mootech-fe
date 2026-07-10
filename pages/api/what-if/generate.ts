import type { NextApiRequest, NextApiResponse } from 'next'

const DEFAULT_BAZI_WHATIF_URL = 'https://bazi-sft-dataset.vercel.app/api/what-if/generate'
const ALLOWED_FIELDS = ['birthDate', 'birthTime', 'gender', 'currentJob', 'withImage'] as const

type AllowedField = (typeof ALLOWED_FIELDS)[number]
type WhatIfProxyBody = Partial<Record<AllowedField, unknown>>

export const config = {
  maxDuration: 60,
}

export function sanitizeWhatIfBody(input: unknown): WhatIfProxyBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}

  const source = input as Record<string, unknown>
  return ALLOWED_FIELDS.reduce<WhatIfProxyBody>((body, key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      body[key] = source[key]
    }
    return body
  }, {})
}

function errorJson(message: string) {
  return { error: { message } }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json(errorJson('Method not allowed'))
    return
  }

  const upstreamUrl = process.env.BAZI_WHATIF_URL || DEFAULT_BAZI_WHATIF_URL

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizeWhatIfBody(req.body)),
    })
  } catch {
    res.status(502).json(errorJson('What If generator unreachable'))
    return
  }

  let payload: unknown
  try {
    payload = await upstream.json()
  } catch {
    res.status(502).json(errorJson('What If generator returned invalid JSON'))
    return
  }

  res.status(upstream.status).json(payload)
}

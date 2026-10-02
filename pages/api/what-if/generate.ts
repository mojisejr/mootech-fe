import type { NextApiRequest, NextApiResponse } from 'next'
import { baziClientHeaders } from '@/lib/bazi/client-identity'
import { baziFetch } from '@/lib/bazi/fetch'

const DEFAULT_BAZI_WHATIF_URL = 'https://bazi-sft-dataset.vercel.app/api/what-if/generate'
const ALLOWED_FIELDS = ['birthDate', 'birthTime', 'gender', 'currentJob', 'withImage'] as const

type AllowedField = (typeof ALLOWED_FIELDS)[number]
type WhatIfProxyBody = Partial<Record<AllowedField, unknown>>

export const config = {
  maxDuration: 60,
}

// BAZI_WHATIF_URL, else the engine every other route uses (BAZI_BASE_URL), else the old Vercel default.
// Was BAZI_WHATIF_URL || the Vercel URL: in a container with only BAZI_BASE_URL=http://bazi:3000 it kept
// calling Vercel (mumate-vercel-to-do-001 slice 2). On Vercel BAZI_BASE_URL is that same host, so nothing moves.
export function whatIfUpstreamUrl(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const explicit = env.BAZI_WHATIF_URL?.trim()
  if (explicit) return explicit
  const base = env.BAZI_BASE_URL?.trim().replace(/\/+$/, '')
  return base ? `${base}/api/what-if/generate` : DEFAULT_BAZI_WHATIF_URL
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

  const upstreamUrl = whatIfUpstreamUrl()

  let upstream: Response
  try {
    upstream = await baziFetch(upstreamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...baziClientHeaders(req) },
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

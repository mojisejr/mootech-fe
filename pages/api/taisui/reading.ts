// POST /api/taisui/reading — ปีชง 2570 reading (ciel-os workstream mumate-taisui-2570-001, design/CONTRACT.md).
// No body birth = the logged-in member's saved chart. A typed birth needs the page's nonce and passes the
// public calculator's per-IP limit. The full reading is only included for a logged-in member.
import type { NextApiRequest, NextApiResponse } from 'next'

import { NONCE_COOKIE, verifyNonce } from '@/lib/calculator/nonce'
import { checkCalculatorRateLimit, clientIpFromHeaders } from '@/lib/calculator/rate-limit'
import { resolveOptionalRouteMember } from '@/lib/v2/resolve-user'
import { assembleReading } from '@/lib/taisui/assemble'
import { isTaisuiOpen } from '@/lib/taisui/live'
import { parseBirth, sameOrigin, savedBirth, senderByCode, yearFactsFor, type EngineBirth } from '@/lib/taisui/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isTaisuiOpen()) return res.status(404).json({ error: 'not_found' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!sameOrigin(req)) return res.status(403).json({ error: 'forbidden' })
  res.setHeader('Cache-Control', 'no-store')

  const body = (req.body ?? {}) as { birth?: unknown; partnerRef?: unknown }
  const memberId = await resolveOptionalRouteMember(req, res)

  let birth: EngineBirth
  let source: 'saved' | 'typed'
  if (body.birth !== undefined) {
    if (!verifyNonce(req.cookies[NONCE_COOKIE])) return res.status(403).json({ error: 'nonce' })
    const rate = checkCalculatorRateLimit(clientIpFromHeaders((h) => (req.headers[h] as string | undefined) ?? null))
    if (!rate.ok) return res.status(429).json({ error: 'rate_limited' })
    const parsed = parseBirth(body.birth)
    if (!parsed) return res.status(400).json({ error: 'invalid_input' })
    birth = parsed
    source = 'typed'
  } else {
    if (!memberId) return res.status(401).json({ code: 'not_authenticated' })
    const saved = await savedBirth(memberId).catch(() => null)
    if (saved === null) return res.status(502).json({ error: 'upstream' })
    if (saved === 'none') return res.status(401).json({ code: 'not_authenticated' })
    if (saved === 'incomplete') return res.status(409).json({ code: 'profile_incomplete' })
    birth = saved
    source = 'saved'
  }

  try {
    const sender = typeof body.partnerRef === 'string' ? await senderByCode(body.partnerRef.trim().toUpperCase()) : null
    const facts = await yearFactsFor(birth, sender?.birth ?? null)
    if (!facts) return res.status(502).json({ error: 'upstream' })
    return res.status(200).json(assembleReading(facts, { member: Boolean(memberId), source }))
  } catch (e) {
    console.error('[taisui/reading] failed', e instanceof Error ? e.name : 'unknown')
    return res.status(502).json({ error: 'upstream' })
  }
}

// GET /api/bazi/mascot/<ganzhi> — proxy to the bazi mascot endpoint (Slice 2C).
// WHY a proxy (same reason as home-fortune): BAZI_BASE_URL is a SERVER env — the browser
// must never see it, so every FE→bazi call goes through a pages/api route. Read-only.
// Graceful by design: any miss (no ganzhi / 404 / 5xx / timeout) → { mascot: null } with
// status 200, so the result screen simply hides the mascot card (rule 4: no data = no show,
// never a hardcoded fake).
import type { NextApiRequest, NextApiResponse } from 'next'

const BAZI_BASE = process.env.BAZI_BASE_URL || 'http://localhost:3000'
if (/bazichart\.mumate\.co/i.test(BAZI_BASE)) {
  throw new Error(`[GUARDRAIL] BAZI_BASE_URL points at old prod (${BAZI_BASE}).`)
}
const BAZI_TIMEOUT_MS = 12000

export type CompatMascot = {
  ganzhi: string
  nameTh: string
  nameEn: string
  imageUrl: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const raw = req.query.ganzhi
  const ganzhi = (Array.isArray(raw) ? raw[0] : raw)?.trim()
  if (!ganzhi) return res.status(200).json({ mascot: null }) // no ganzhi → nothing to show

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), BAZI_TIMEOUT_MS)
    const r = await fetch(`${BAZI_BASE}/api/bazi/mascot/${encodeURIComponent(ganzhi)}`, {
      method: 'GET',
      signal: ac.signal,
    })
    clearTimeout(timer)
    if (!r.ok) return res.status(200).json({ mascot: null }) // 404 (no mascot for ganzhi) / 5xx → hide card
    const data = (await r.json()) as Partial<CompatMascot>
    if (!data?.imageUrl) return res.status(200).json({ mascot: null }) // no image → nothing to render
    return res.status(200).json({
      mascot: {
        ganzhi: data.ganzhi ?? ganzhi,
        nameTh: data.nameTh ?? '',
        nameEn: data.nameEn ?? '',
        imageUrl: data.imageUrl,
      },
    })
  } catch {
    return res.status(200).json({ mascot: null }) // timeout / unreachable → hide card, never throw at the user
  }
}

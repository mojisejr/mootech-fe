// GET /api/bazi/mascot/<ganzhi> — proxy to the bazi mascot endpoint (Slice 2C · 3B v2 swap).
// WHY a proxy (same reason as home-fortune): BAZI_BASE_URL is a SERVER env — the browser
// must never see it, so every FE→bazi call goes through a pages/api route. Read-only.
// Graceful by design: any miss (no ganzhi / 404 / 5xx / timeout) → { mascot: null } with
// status 200, so the result screen simply hides the mascot card (rule 4: no data = no show,
// never a hardcoded fake).
//
// 3B (ฟีม 2026-08-02): v2 shows the NEW mascot set ONLY. Read `imageUrlV2` EXCLUSIVELY and
// ❌ NEVER fall back to the legacy `imageUrl` — a row that has the old image but no v2 image must
// HIDE the card (that is exactly what ฟีม wants: v2 = ชุดใหม่เท่านั้น, ไม่ให้ของเก่าแอบโผล่).
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
  /** the URL the card renders — sourced from bazi `imageUrlV2` (the v2 set), never the legacy `imageUrl` */
  imageUrl: string
}

/** bazi GET /api/bazi/mascot/<ganzhi> response — only the fields this proxy reads. */
export type BaziMascotResponse = Partial<{
  ganzhi: string
  nameTh: string
  nameEn: string
  imageUrl: string | null // legacy set — intentionally IGNORED by 3B
  imageUrlV2: string | null // v2 set — the ONLY source the card renders
}>

/**
 * PURE — map a bazi mascot response to the FE `{ mascot }` contract, reading `imageUrlV2` ONLY.
 * No `imageUrlV2` (null / '' / missing) → `{ mascot: null }` so the card hides. Never falls back to
 * the legacy `imageUrl`, even when it is present (3B invariant: v2 renders the v2 set exclusively).
 */
export function mascotFromBaziResponse(
  data: BaziMascotResponse | null | undefined,
  fallbackGanzhi: string,
): { mascot: CompatMascot | null } {
  const v2 = data?.imageUrlV2?.trim()
  if (!v2) return { mascot: null }
  return {
    mascot: {
      ganzhi: data?.ganzhi ?? fallbackGanzhi,
      nameTh: data?.nameTh ?? '',
      nameEn: data?.nameEn ?? '',
      imageUrl: v2,
    },
  }
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
    const data = (await r.json()) as BaziMascotResponse
    return res.status(200).json(mascotFromBaziResponse(data, ganzhi)) // 3B: imageUrlV2 only, no legacy fallback
  } catch {
    return res.status(200).json({ mascot: null }) // timeout / unreachable → hide card, never throw at the user
  }
}

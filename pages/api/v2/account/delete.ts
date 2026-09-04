// /api/v2/account/delete — ลบบัญชีแบบ "พัก 30 วัน" (ผ่าน engine bazi-pdf-dev) — อัปเกรดจาก 501 จริงใส.
//   POST   { reason? } → ขอลบ: pending, purge_at = +30 วัน (409 = มีคำขอรออยู่แล้ว)
//   GET    → สถานะคำขอ ({deletion: {...} | null})
//   DELETE → ยกเลิกการลบ (กลับมาใช้ได้ทันที)
//   PATCH  { feedback } → feedback ของคนที่จะลบ (delete-05b)
// identity = cookie-mumate-id → engine anonId (เช่นเดียวกับ qi/profile BFF ทุกเส้น)
import type { NextApiRequest, NextApiResponse } from 'next'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['POST', 'GET', 'DELETE', 'PATCH'].includes(req.method ?? '')) {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const rawId = req.cookies['cookie-mumate-id'] ?? ''
  if (!UUID_RE.test(rawId)) return res.status(401).json({ code: 'not_authenticated' })

  const base = process.env.BAZI_BASE_URL || 'http://localhost:3000'
  try {
    const query = `?anonId=${encodeURIComponent(rawId)}`
    const upstream = await fetch(`${base}/api/account/delete${req.method === 'GET' || req.method === 'DELETE' ? query : ''}`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: ['POST', 'PATCH'].includes(req.method ?? '') ? JSON.stringify({ ...(req.body ?? {}), anonId: rawId }) : undefined,
    })
    const payload = await upstream.json().catch(() => ({}))
    res.status(upstream.ok ? 200 : upstream.status).json(payload)
  } catch {
    res.status(502).json({ error: 'account delete unreachable' })
  }
}

// ส่ง "ผู้ใช้คนไหน" ไปให้ bazi เพื่อให้ rate limit / โควตาของ engine เป็นรายผู้ใช้ (mumate-vercel-to-do-001 slice 2, owner D)
//
// FE เรียก bazi จากฝั่ง server เสมอ → x-forwarded-for ที่ bazi เห็นคือ IP ของ FE ไม่ใช่ของผู้ใช้: บน Vercel คือ egress IP
// ไม่กี่ตัวที่ผู้ใช้ทุกคนแชร์, ใน container บน DO (FE → http://bazi:3000) ไม่มีเลย → ทุกคนอยู่ใน bucket "unknown" เดียวกัน.
// เราส่ง IP ของผู้ใช้ (ตัวแรกใน x-forwarded-for ที่ Vercel / Caddy ตั้งให้ — ตัวเดียวกับที่ calculator rate limit ใช้)
// พร้อม BAZI_CLIENT_ID_SECRET; bazi เชื่อ IP นี้เฉพาะเมื่อ secret ตรง (bazi src/lib/rate-limit.ts clientIp).
// ไม่ตั้ง secret = ไม่ส่งอะไร (พฤติกรรมเดิม). server only — secret ห้ามมีชื่อ NEXT_PUBLIC_
import type { IncomingHttpHeaders } from 'http'
import { clientIpFromHeaders } from '@/lib/calculator/rate-limit'

export function baziClientHeaders(
  req: { headers: IncomingHttpHeaders },
  env: Partial<NodeJS.ProcessEnv> = process.env,
): Record<string, string> {
  const secret = env.BAZI_CLIENT_ID_SECRET?.trim()
  if (!secret) return {}
  const ip = clientIpFromHeaders((name) => {
    const v = req.headers[name]
    return Array.isArray(v) ? v[0] : v
  })
  if (!ip || ip === 'unknown') return {}
  return { 'x-mumate-client-ip': ip, 'x-mumate-client-secret': secret }
}

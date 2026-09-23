// POST /api/v2/share/snapshot — เก็บ "สแนปช็อตการ์ดแชร์" ใต้โค้ดสั้น (#359 ซินแสนุ้ย รอบ 14 2026-09-15).
// คืน { id } (base62 สั้น) → ฝั่ง client เอาไปทำลิงก์แชร์ /invite/<referral>?c=<id> (สั้น กดได้).
// หน้า /invite อ่านแถวนี้ฝั่ง server เพื่อทำ og:image เฉพาะผล. ต้องมี session (แชร์ผลได้เฉพาะผู้ล็อกอิน).
import type { NextApiRequest, NextApiResponse } from "next"
import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { shareSnapshot } from "@/lib/db/schema"
import { resolveSessionUserId } from "@/lib/v2/resolve-user"

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// โค้ดสั้น base62 (10 ตัว ≈ 59 บิต — ชนกันแทบเป็นไปไม่ได้สำหรับปริมาณแชร์)
function shortId(len = 10): string {
  const bytes = randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

interface SnapshotBody {
  title?: string
  subtitle?: string
  summary?: string
  tag?: string
  image?: string
  skills?: string // encode แล้ว: label|percent|grade|color|top คั่นแถวด้วย "~"
  isPublic?: boolean // ยินยอมเปิดเผยให้คนอื่นอ่านผลเต็ม (0033)
  fullText?: string // คำทำนายเต็ม (เก็บเฉพาะเมื่อ isPublic)
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ ok: false, error: who.error })

  try {
    const body = (req.body ?? {}) as SnapshotBody
    const title = str(body.title, 120)
    if (!title) return res.status(400).json({ ok: false, error: "ต้องมี title" })

    const id = shortId()
    // เปิดเผย = ต้องมี fullText จริง ๆ ถึงจะถือว่าเปิดอ่านได้ (กัน public เปล่า)
    const isPublic = body.isPublic === true
    const fullText = isPublic ? str(body.fullText, 8000) : null
    const base = {
      id,
      userId: who.userId,
      title,
      subtitle: str(body.subtitle, 120),
      summary: str(body.summary, 1500), // เอ็ม 2026-09-23: 400 สั้นไป → สรุปที่แชร์ถูกตัดกลางคำ. column เป็น text อยู่แล้ว (การ์ด OG clamp เอง)
      tag: str(body.tag, 40),
      image: str(body.image, 1500), // รองรับไพ่หลายใบ (URL คั่นด้วย ",")
      skills: str(body.skills, 400),
    }
    // ⚠️ แตะคอลัมน์ใหม่ (0033) เฉพาะกรณี "เปิดเผย" เท่านั้น — แชร์ปกติ insert เหมือนเดิม จึงไม่พังถ้ายังไม่ได้รัน migration
    await db.insert(shareSnapshot).values(
      isPublic && fullText ? { ...base, isPublic: true, fullText, consentedAt: new Date() } : base,
    )
    return res.status(200).json({ ok: true, id })
  } catch (err) {
    console.error("[share/snapshot] failed", err)
    return res.status(500).json({ ok: false, error: "snapshot failed" })
  }
}

// pages/api/og/finder.ts — ประกอบ "wallpaper เต็มใบ" เป็นการ์ด OG/Twitter 1200×630 (ไม่ครอปตัวละคร/คำ).
// X แสดงการ์ดพรีวิวเป็นแนวนอน 1.91:1 → เราวาง wallpaper 9:16 แบบ "contain" กลางการ์ด บนพื้นเบลอของ bg เดิม
// → เห็น wallpaper เต็มใบ ไม่โดนครอป. ใช้ sharp (nodejs) เพราะรองรับ .webp (ต่างจาก next/og/satori).
import type { NextApiRequest, NextApiResponse } from "next"
import sharp from "sharp"

// อนุญาตเฉพาะ asset ของฟีเจอร์นี้ (กัน SSRF/พาธมั่ว)
const ALLOW: RegExp[] = [/^\/images\/v2\/element-finder\/bg\/[^?]+\.png$/, /^\/images\/v2\/characters\/[^?]+\.webp$/, /^\/images\/v2\/element-finder\/text\/[^?]+\.png$/]
const ok = (p: unknown, i: number): p is string => typeof p === "string" && ALLOW[i].test(p)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const bg = req.query.bg, ch = req.query.ch, txt = req.query.txt
  if (!ok(bg, 0) || !ok(ch, 1) || !ok(txt, 2)) {
    res.status(400).end("bad params"); return
  }
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https"
  const origin = `${proto}://${req.headers.host}`
  const get = async (p: string) => Buffer.from(await (await fetch(origin + p)).arrayBuffer())
  try {
    const [bgBuf, chBuf, txtBuf] = await Promise.all([get(bg), get(ch), get(txt)])
    // ประกอบ wallpaper 9:16 (1080×1920) ตามเลย์เอาต์เดียวกับ WallpaperCard: bg cover → character (สูง36% ล่าง24%) → text เต็มใบ
    const W = 1080, H = 1920
    const bgL = await sharp(bgBuf).resize(W, H, { fit: "cover" }).toBuffer()
    const chR = await sharp(chBuf).resize({ height: Math.round(H * 0.36) }).toBuffer()
    const chMeta = await sharp(chR).metadata()
    const chTop = Math.max(0, H - Math.round(H * 0.24) - (chMeta.height ?? 0))
    const chLeft = Math.max(0, Math.round((W - (chMeta.width ?? 0)) / 2))
    const txtL = await sharp(txtBuf).resize(W, H, { fit: "inside" }).toBuffer()
    const portrait = await sharp(bgL)
      .composite([{ input: chR, top: chTop, left: chLeft }, { input: txtL, top: 0, left: 0 }])
      .png().toBuffer()
    // การ์ดแนวนอน 1200×630: พื้น = bg เบลอ (cover) + wallpaper contain กลาง
    const LW = 1200, LH = 630, cardH = 612
    const backdrop = await sharp(bgBuf).resize(LW, LH, { fit: "cover" }).blur(26).toBuffer()
    const card = await sharp(portrait).resize({ height: cardH }).toBuffer()
    const cMeta = await sharp(card).metadata()
    const out = await sharp(backdrop)
      .composite([{ input: card, top: Math.round((LH - cardH) / 2), left: Math.round((LW - (cMeta.width ?? 0)) / 2) }])
      .png().toBuffer()
    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400")
    res.status(200).end(out)
  } catch {
    res.status(500).end("compose failed")
  }
}

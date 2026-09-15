// pages/api/og/share.tsx — #359 รอบ 13: OG image เฉพาะบุคคล (next/og, edge)
// สร้างการ์ดพรีวิว render ฝั่ง server จาก query params → ใช้เป็น og:image ของลิงก์ /invite
// เพื่อให้ Messenger/LINE/FB โชว์ "ลิงก์กดได้ + พรีวิวการ์ดเฉพาะบุคคล" (แทนการแนบไฟล์รูปที่ทำให้ลิงก์หาย)
//
// params: t=title, s=subtitle, d=summary, g=tag, m=mascot image URL (relative/absolute)
// ฟอนต์ไทย: fetch IBM Plex Sans Thai (.ttf) ตอน render (edge fetch ได้) — ไม่มี asset ฟอนต์ในรีโป
import { ImageResponse } from "next/og"

export const config = { runtime: "edge" }

const FONT_REG = "https://cdn.jsdelivr.net/gh/google/fonts/ofl/ibmplexsansthai/IBMPlexSansThai-Regular.ttf"
const FONT_BOLD = "https://cdn.jsdelivr.net/gh/google/fonts/ofl/ibmplexsansthai/IBMPlexSansThai-Bold.ttf"

async function font(url: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url, { cache: "force-cache" })
    return r.ok ? await r.arrayBuffer() : null
  } catch {
    return null
  }
}

function clamp(s: string, max: number): string {
  const t = s.trim()
  return t.length <= max ? t : t.slice(0, max).trimEnd() + "…"
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams, origin } = new URL(req.url)
  const title = clamp(searchParams.get("t") || "ดวงของฉัน", 60)
  const subtitle = clamp(searchParams.get("s") || "", 40)
  const summary = clamp(searchParams.get("d") || "ดูดวงจีนเฉพาะคุณกับ Mumate", 180)
  const tag = clamp(searchParams.get("g") || "", 24)
  // m = รูป (มาสคอต 1 รูป หรือไพ่หลายใบคั่นด้วย ",") — resolve relative → absolute, เก็บสูงสุด 3
  const resolveImg = (s: string) => (s.startsWith("http") ? s : `${origin}${s.startsWith("/") ? "" : "/"}${s}`)
  const imgs = (searchParams.get("m") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(resolveImg)
  // รอบ 14: พื้นหลัง = ภาพฉากพาสเทล (ไม่ใช่ไล่สีน้ำเงิน) + ตัวหนังสือเข้ม ให้เข้าชุดการ์ดแชร์
  const bg = `${origin}/images/v2/destiny/bg-destiny.jpg`

  const [reg, bold] = await Promise.all([font(FONT_REG), font(FONT_BOLD)])
  const fonts = [
    ...(reg ? [{ name: "Plex", data: reg, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Plex", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          fontFamily: "Plex",
          backgroundColor: "#cfe6f5",
        }}
      >
        {/* พื้นหลังภาพฉากพาสเทล */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        {/* ม่านขาวจาง ให้ตัวหนังสือเข้มอ่านชัด */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(255,255,255,0.42)" }} />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: "56px",
            gap: "44px",
            color: "#0b305b",
          }}
        >
          {imgs.length >= 2 ? (
            // ไพ่หลายใบ — เรียงเป็นแถว (เห็นครบทุกใบ)
            <div style={{ display: "flex", flexDirection: "row", gap: 14, flexShrink: 0, alignItems: "center" }}>
              {imgs.map((src, i) => {
                const w = imgs.length >= 3 ? 148 : 176
                const h = Math.round(w * 1.34)
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} width={w} height={h} style={{ width: w, height: h, objectFit: "cover", borderRadius: 16, border: "3px solid #ffffff" }} alt="" />
                )
              })}
            </div>
          ) : imgs.length === 1 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgs[0]} width={320} height={400} style={{ width: 320, height: 400, objectFit: "contain", flexShrink: 0 }} alt="" />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, color: "#0b305b" }}>Mumate</span>
              {tag ? (
                <span style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", background: "#0b305b", borderRadius: 999, padding: "6px 18px" }}>{tag}</span>
              ) : null}
            </div>
            <div style={{ display: "flex", fontSize: 52, fontWeight: 700, lineHeight: 1.15, color: "#0b305b" }}>{title}</div>
            {subtitle ? (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#1455A4", marginTop: 10 }}>{subtitle}</div>
            ) : null}
            <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: "#243449", marginTop: 18 }}>{summary}</div>
            <div style={{ display: "flex", marginTop: "auto", fontSize: 22, fontWeight: 700, color: "#1455A4" }}>bazichart.mumate.co</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts.length ? { fonts } : {}),
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
    },
  )
}

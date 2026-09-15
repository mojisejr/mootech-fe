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
  const mRaw = searchParams.get("m") || ""
  const mascot = mRaw ? (mRaw.startsWith("http") ? mRaw : `${origin}${mRaw.startsWith("/") ? "" : "/"}${mRaw}`) : ""

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
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          padding: "56px",
          gap: "44px",
          fontFamily: "Plex",
          color: "#ffffff",
          background: "linear-gradient(135deg, #1B62B3 0%, #12489B 55%, #0B2A65 100%)",
        }}
      >
        {mascot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mascot}
            width={300}
            height={380}
            style={{ width: 300, height: 380, objectFit: "cover", borderRadius: 24, background: "rgba(255,255,255,0.1)", flexShrink: 0 }}
            alt=""
          />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Mumate</span>
            {tag ? (
              <span style={{ fontSize: 22, fontWeight: 700, background: "rgba(255,255,255,0.18)", borderRadius: 999, padding: "6px 18px" }}>{tag}</span>
            ) : null}
          </div>
          <div style={{ display: "flex", fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#FFD84D", marginTop: 10 }}>{subtitle}</div>
          ) : null}
          <div style={{ display: "flex", fontSize: 26, lineHeight: 1.4, color: "rgba(255,255,255,0.92)", marginTop: 18 }}>{summary}</div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>bazichart.mumate.co</div>
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

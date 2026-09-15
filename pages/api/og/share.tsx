// pages/api/og/share.tsx — #359 รอบ 13: OG image เฉพาะบุคคล (next/og, edge)
// สร้างการ์ดพรีวิว render ฝั่ง server จาก query params → ใช้เป็น og:image ของลิงก์ /invite
// เพื่อให้ Messenger/LINE/FB โชว์ "ลิงก์กดได้ + พรีวิวการ์ดเฉพาะบุคคล" (แทนการแนบไฟล์รูปที่ทำให้ลิงก์หาย)
//
// params: t=title, s=subtitle, d=summary, g=tag, m=รูป (คั่น "," ได้: มาสคอต 1-2 / ไพ่สูงสุด 3),
//         k=แถบสกิล (แถวคั่น "~", ฟิลด์คั่น "|": label|percent|grade|color|top(1/0)) — เฉพาะดวงธาตุ
// ฟอนต์ไทย: fetch IBM Plex Sans Thai (.ttf) ตอน render (edge fetch ได้) — ไม่มี asset ฟอนต์ในรีโป
import { ImageResponse } from "next/og"

type Skill = { label: string; pct: number; grade: string; color: string; top: boolean }

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
  const tag = clamp(searchParams.get("g") || "", 24)
  // แถบสกิล (เฉพาะดวงธาตุ): label|percent|grade|color|top(1/0) คั่นแถวด้วย "~"
  const skills: Skill[] = (searchParams.get("k") || "")
    .split("~")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((row) => {
      const [label = "", pct = "", grade = "", color = "", top = ""] = row.split("|")
      return { label, pct: Math.max(0, Math.min(100, Number(pct) || 0)), grade, color: color || "#1455A4", top: top === "1" }
    })
  // มีสกิล → คำโปรยสั้นลงให้มีที่วางแถบ
  const summary = clamp(searchParams.get("d") || "ดูดวงจีนเฉพาะคุณกับ Mumate", skills.length ? 110 : 180)
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
          {imgs.length >= 3 ? (
            // ไพ่หลายใบ — เรียงเป็นแถว (เห็นครบทุกใบ, พอร์ตเทรตครอบ)
            <div style={{ display: "flex", flexDirection: "row", gap: 12, flexShrink: 0, alignItems: "center" }}>
              {imgs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} width={146} height={196} style={{ width: 146, height: 196, objectFit: "cover", borderRadius: 16, border: "3px solid #ffffff" }} alt="" />
              ))}
            </div>
          ) : imgs.length === 2 ? (
            // สมพงศ์ — มาสคอต 2 คน (contain ไม่ครอบตัด)
            <div style={{ display: "flex", flexDirection: "row", gap: 8, flexShrink: 0, alignItems: "center" }}>
              {imgs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} width={210} height={250} style={{ width: 210, height: 250, objectFit: "contain", flexShrink: 0 }} alt="" />
              ))}
            </div>
          ) : imgs.length === 1 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgs[0]} width={skills.length ? 280 : 320} height={skills.length ? 350 : 400} style={{ width: skills.length ? 280 : 320, height: skills.length ? 350 : 400, objectFit: "contain", flexShrink: 0 }} alt="" />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: skills.length ? 10 : 18 }}>
              <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, color: "#0b305b" }}>Mumate</span>
              {tag ? (
                <span style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", background: "#0b305b", borderRadius: 999, padding: "6px 18px" }}>{tag}</span>
              ) : null}
            </div>
            <div style={{ display: "flex", fontSize: skills.length ? 42 : 52, fontWeight: 700, lineHeight: 1.15, color: "#0b305b" }}>{title}</div>
            {subtitle ? (
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#1455A4", marginTop: 10 }}>{subtitle}</div>
            ) : null}
            <div style={{ display: "flex", fontSize: skills.length ? 22 : 26, lineHeight: 1.4, color: "#243449", marginTop: skills.length ? 10 : 18 }}>{summary}</div>
            {skills.length ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
                {skills.map((s, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", marginTop: i ? 14 : 0 }}>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ display: "flex", flex: 1, fontSize: 24, fontWeight: 700, color: "#0b305b" }}>{s.label}</span>
                      {s.top ? (
                        <span style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 5, fontSize: 18, fontWeight: 700, color: "#2e7d32", background: "#DDF3D8", borderRadius: 999, padding: "3px 14px" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" fill="#F2B01E" /></svg>
                          จุดแข็ง
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", flex: 1, height: 14, background: "rgba(11,48,91,0.12)", borderRadius: 999 }}>
                        <div style={{ display: "flex", width: `${s.pct}%`, height: 14, background: s.color, borderRadius: 999 }} />
                      </div>
                      <span style={{ display: "flex", width: 64, justifyContent: "flex-end", fontSize: 22, fontWeight: 700, color: s.color }}>{s.pct}%</span>
                      <span style={{ display: "flex", fontSize: 20, fontWeight: 700, color: "#ffffff", background: s.color, borderRadius: 999, padding: "2px 12px" }}>{s.grade}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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

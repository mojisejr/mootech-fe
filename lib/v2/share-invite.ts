// แชร์ผล = "ลิงก์เชิญเพื่อนของ user เอง" + แนบภาพการ์ด (ผู้ใช้ 2026-09-12).
// - link ที่แชร์ = /invite/<referral-code> ของ user → คนสมัครผ่านลิงก์นี้ = user ได้ QI (referral)
// - ภาพ: ถ้าเบราว์เซอร์รองรับ navigator.share({files}) จะแนบภาพการ์ดไปในชีตแชร์ด้วย
//   (fallback: แชร์ url+text; OG ของหน้า /invite ยังโชว์การ์ดแบรนด์ให้ผู้รับลิงก์เห็น)

/** ลิงก์เชิญเพื่อนของ user: /invite/<code> (คนสมัครผ่านลิงก์นี้ → user ได้ QI). fallback = origin */
export async function fetchInviteUrl(): Promise<string> {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  try {
    const r = await fetch("/api/referral")
    const j = (r.ok ? await r.json().catch(() => null) : null) as { code?: unknown } | null
    const code = typeof j?.code === "string" ? j.code.trim() : ""
    return code ? `${origin}/invite/${encodeURIComponent(code)}` : origin
  } catch {
    return origin
  }
}

export type ShareResult = "shared" | "copied" | "failed"

/** แชร์เป็นคำเชิญ: url = ลิงก์เชิญของ user, แนบภาพการ์ด (ถ้ารองรับ). */
export async function shareAsInvite({
  title,
  text,
  imageUrl,
}: {
  title: string
  text: string
  imageUrl?: string | null
}): Promise<ShareResult> {
  const url = await fetchInviteUrl()
  const nav = typeof navigator !== "undefined" ? navigator : undefined

  // พยายามดึงภาพการ์ดมาแนบ (best-effort — ล้มก็แชร์แค่ url+text)
  let files: File[] | undefined
  if (imageUrl) {
    try {
      const resp = await fetch(imageUrl)
      if (resp.ok) {
        const blob = await resp.blob()
        if (blob.size > 0) files = [new File([blob], "mumate-card.jpg", { type: blob.type || "image/jpeg" })]
      }
    } catch {
      /* ภาพโหลดไม่ได้ → แชร์แบบไม่มีไฟล์ */
    }
  }

  try {
    if (nav?.share) {
      const canFiles = files && typeof nav.canShare === "function" && nav.canShare({ files })
      await nav.share(canFiles ? { title, text, url, files } : { title, text, url })
      return "shared"
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(`${text} ${url}`)
      return "copied"
    }
  } catch {
    /* ผู้ใช้กดยกเลิก หรือ error → ถือว่าไม่สำเร็จ (ไม่ throw) */
  }
  return "failed"
}

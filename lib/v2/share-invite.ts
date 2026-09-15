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

/** แชร์เป็นคำเชิญ: url = ลิงก์เชิญของ user, แนบภาพการ์ด (ถ้ารองรับ).
 *  #6 (2026-09-15): รับ `file` = ภาพการ์ดเฉพาะบุคคลที่ render มาแล้ว (html2canvas) → แนบตรง ไม่ต้อง fetch.
 *  ถ้าไม่มี `file` แต่มี `imageUrl` → fetch มาแนบเหมือนเดิม (backward-compatible). */
export async function shareAsInvite({
  title,
  text,
  imageUrl,
  file,
}: {
  title: string
  text: string
  imageUrl?: string | null
  file?: File | null
}): Promise<ShareResult> {
  const url = await fetchInviteUrl()
  const nav = typeof navigator !== "undefined" ? navigator : undefined

  // พยายามแนบภาพการ์ด (best-effort — ล้มก็แชร์แค่ url+text): file ที่ render แล้วก่อน, ไม่งั้น fetch จาก imageUrl
  let files: File[] | undefined
  if (file && file.size > 0) {
    files = [file]
  } else if (imageUrl) {
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

  // #359 รอบ 10: หลายแอป (LINE/IG/มือถือ) เวลาแนบไฟล์รูป จะ "ทิ้ง" field url/text ทำให้ลิงก์ชวน + slug หาย.
  // แก้โดยฝังลิงก์เชิญไว้ใน text ด้วย → ลิงก์ (พร้อมโค้ดผู้ชวน) รอดแม้ url จะถูกตัดตอนแนบไฟล์.
  const textWithLink = `${text}\n${url}`
  try {
    if (nav?.share) {
      const canFiles = files && typeof nav.canShare === "function" && nav.canShare({ files })
      await nav.share(canFiles ? { title, text: textWithLink, files } : { title, text: textWithLink, url })
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

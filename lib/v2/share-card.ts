// lib/v2/share-card.ts — #6 (ซินแสนุ้ย 2026-09-15): render การ์ดแชร์เฉพาะบุคคล (DOM) → ไฟล์ภาพ (html2canvas)
// เพื่อแนบตอนกดแชร์ (shareAsInvite({file})). precedent: features/v2-shop/components/SinsaeBookingSuccess.tsx.
// robust: dynamic import + รอรูปโหลดครบก่อน capture + try/catch (ล้ม → null → แชร์แค่ url+text).

async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"))
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true })
              img.addEventListener("error", () => res(), { once: true })
            }),
    ),
  )
}

/** แปลง DOM node → File (jpeg) สำหรับแนบตอนแชร์. คืน null ถ้า render ไม่ได้ (เช่น รูป cross-origin ทำ canvas tainted). */
export async function captureShareImage(node: HTMLElement | null): Promise<File | null> {
  if (!node) return null
  try {
    await waitForImages(node)
    const html2canvas = (await import("html2canvas")).default
    const canvas = await html2canvas(node, { backgroundColor: null, scale: 2, useCORS: true, logging: false })
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.92))
    if (!blob || blob.size === 0) return null
    return new File([blob], "mumate-card.jpg", { type: "image/jpeg" })
  } catch {
    return null
  }
}

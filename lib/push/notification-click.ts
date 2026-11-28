// lib/push/notification-click.ts — logic ของ sw.ts `notificationclick` แยกไว้ให้ทดสอบได้ (PURE, รับ client เป็นพารามิเตอร์)
//
// 🔴 บั๊กเดิม (ประชุม 24 พ.ย. ข้อ 6): ถ้าแอปเปิดอยู่แล้ว handler แค่ focus() หน้าต่างเดิม ไม่พาไปหน้าที่แจ้งเตือนชี้
//    → กดแจ้งเตือน "ดวงวันนี้" แล้วขึ้นหน้าเดิมที่ค้างอยู่ ไม่เห็นดวง
// ทางแก้: หน้าต่างที่อยู่โดเมนเดียวกับแอป (ที่ navigate ได้) → navigate(url) แล้ว focus · navigate ไม่ได้ (หน้าต่างปิด/
//    ข้ามโดเมน) → อย่างน้อย focus · ไม่มีหน้าต่างเลย → null ให้ผู้เรียก openWindow(url)
export type WindowClientLike = {
  url: string
  focus(): Promise<unknown>
  navigate(url: string): Promise<unknown>
}

function sameOrigin(w: WindowClientLike, origin: string): boolean {
  try {
    return new URL(w.url, origin).origin === origin
  } catch {
    return false
  }
}

export async function focusOrOpenUrl(windows: readonly WindowClientLike[], url: string, origin: string): Promise<WindowClientLike | null> {
  // เรียก navigate ทันทีที่ได้ client (ไม่รออะไรก่อน) — user activation ของการกดแจ้งเตือนมีอายุสั้น
  const existing = windows.find((w) => sameOrigin(w, origin)) ?? windows[0]
  if (!existing) return null
  try {
    await existing.navigate(url)
  } catch {
    /* navigate ไม่ได้ → อย่างน้อยโฟกัสหน้าต่างเดิมให้ ไม่ทิ้งผู้ใช้ไว้กลางอากาศ */
  }
  try {
    await existing.focus()
  } catch {
    /* หน้าต่างหายไประหว่างทาง */
  }
  return existing
}

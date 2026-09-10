// daily-reading-cache.ts — แคชผลทำนายรายวัน "แยกตามเบอร์" (localStorage)
// กติกา: เบอร์ที่ทำนายแล้ววันนี้ → ดูซ้ำได้ฟรี (ไม่คำนวณ/หัก QI ใหม่) ทุกเบอร์ที่ดูวันนั้น;
// ข้ามวัน (Bangkok date เปลี่ยน) → ลบทั้งก้อน คำนวณ+หักใหม่ แม้เป็นเบอร์เดิม.
export type DayEntry<T> = { reading: T; narration: string | null }
type DayCache<T> = { date: string; last: string; entries: Record<string, DayEntry<T>> }

export function bkkToday(): string {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()) } catch { return new Date().toISOString().slice(0, 10) }
}

function read<T>(key: string): DayCache<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const c = JSON.parse(raw) as DayCache<T>
    if (c?.date !== bkkToday() || !c.entries) return null // ข้ามวัน = ถือว่าว่าง (จะถูกเขียนทับ)
    return c
  } catch { return null }
}

/** entry ของเบอร์นี้ "วันนี้" (null = ยังไม่ได้ทำนายวันนี้ → ต้องหัก/คำนวณใหม่) */
export function getDayEntry<T>(key: string, phoneDigits: string): DayEntry<T> | null {
  const c = read<T>(key)
  return c?.entries[phoneDigits] ?? null
}

/** entry ล่าสุดที่ดูวันนี้ (ไว้ restore ตอนกลับเข้าหน้า) */
export function getLastEntry<T>(key: string): (DayEntry<T> & { phoneDigits: string }) | null {
  const c = read<T>(key)
  if (!c || !c.last) return null
  const e = c.entries[c.last]
  return e ? { ...e, phoneDigits: c.last } : null
}

export function putDayEntry<T>(key: string, phoneDigits: string, reading: T, narration: string | null): void {
  try {
    const today = bkkToday()
    const cur = read<T>(key)
    const entries = cur ? { ...cur.entries } : {}
    entries[phoneDigits] = { reading, narration }
    const next: DayCache<T> = { date: today, last: phoneDigits, entries }
    localStorage.setItem(key, JSON.stringify(next))
  } catch { /* ignore */ }
}

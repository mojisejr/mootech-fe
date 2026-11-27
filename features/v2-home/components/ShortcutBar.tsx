// features/v2-home/components/ShortcutBar.tsx — แถบทางลัด 4 ช่องบนหน้าหลัก (Home v3 รอบแรก · ประชุม 24 พ.ย. 2569 ข้อ 1)
// เฟรม `Home — UX v3`: 4 ช่องใต้หัวจอ กด = ไปหน้านั้น · "แก้ไขทางลัด" = แตะช่องแล้วเลือกจากรายการ · เก็บใน localStorage ของเครื่อง
//
// 🔴 บล็อกเทาก่อนอ่าน storage: V2HomeScreen ถูก render ฝั่ง server ด้วย (HomeSkeleton) — ถ้าอ่าน localStorage ตั้งแต่
//    เฟรมแรกจะไม่ตรงกับ SSR (hydration mismatch) จึงวาดบล็อกเทาขนาดเท่าไทล์จริงก่อน แล้วเติมของจริงหลัง mount
//    (ไม่มี layout jump: กล่องขนาดเดิมทุกช่องตั้งแต่เฟรมแรก)
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { track } from '@/lib/analytics/track'
import { OverlayPortal, SheetShell } from '@/features/v2-profile/components/kit'
import { DEFAULT_SHORTCUTS, parseShortcuts, shortcutByKey, SHORTCUT_CATALOG, SHORTCUT_EVENT, SHORTCUT_KEY, SHORTCUT_SLOTS } from '../shortcuts'

const TILE = 'flex h-[64px] w-full flex-col items-center justify-center gap-1 rounded-[18px] bg-white/90 shadow-[0_4px_12px_rgba(26,38,77,0.08)]'

/** สลับให้ไม่มีช่องซ้ำ: เลือกทางลัดที่อยู่ช่องอื่นอยู่แล้ว → สลับกับของเดิมของช่องนี้ PURE */
export function withShortcut(keys: readonly string[], slot: number, key: string): string[] {
  const next = [...keys]
  const old = next[slot]
  const other = next.indexOf(key)
  next[slot] = key
  if (other !== -1 && other !== slot) next[other] = old
  return next
}

export function ShortcutBar() {
  const [keys, setKeys] = useState<string[] | null>(null) // null = ยังไม่อ่าน storage → บล็อกเทา
  const [editing, setEditing] = useState(false)
  const [slot, setSlot] = useState<number | null>(null)

  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(SHORTCUT_KEY)
    } catch {
      raw = null // storage เสีย/โหมดส่วนตัว → ใช้ค่าเริ่มต้น
    }
    setKeys(parseShortcuts(raw))
  }, [])

  const pick = (i: number, key: string) => {
    const next = withShortcut(keys ?? DEFAULT_SHORTCUTS, i, key)
    setKeys(next)
    try {
      window.localStorage.setItem(SHORTCUT_KEY, JSON.stringify(next))
    } catch {
      /* storage เสีย → ใช้ได้เฉพาะรอบนี้ */
    }
    window.dispatchEvent(new Event(SHORTCUT_EVENT))
    track('home_shortcut_set', { slot: String(i), target: key })
    setSlot(null)
    setEditing(false)
  }

  return (
    <div className="px-2 pb-1 pt-1" data-testid="home-shortcuts">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: SHORTCUT_SLOTS }, (_, i) => {
          const s = keys ? shortcutByKey(keys[i] ?? '') : null
          if (!s) {
            return (
              <div key={i} aria-hidden className={TILE} data-testid={`home-shortcut-skeleton-${i}`}>
                <span className="size-6 animate-pulse rounded-full bg-v3-border-card" />
                <span className="h-2.5 w-10 animate-pulse rounded bg-v3-border-card" />
              </div>
            )
          }
          const face = (
            <>
              <span aria-hidden className="text-[22px] leading-6">{s.icon}</span>
              <span className="text-[11px] font-bold leading-4 text-v3-navy">{s.label}</span>
            </>
          )
          return editing ? (
            <button key={i} type="button" onClick={() => setSlot(i)} data-testid={`home-shortcut-edit-${i}`} className={`${TILE} ring-2 ring-v3-sapphire/40`}>
              {face}
            </button>
          ) : (
            <Link key={i} href={s.href} data-testid={`home-shortcut-${i}`}
              onClick={() => track('home_shortcut_open', { slot: String(i), target: s.key })} className={TILE}>
              {face}
            </Link>
          )
        })}
      </div>
      <div className="mt-1 flex justify-end">
        <button type="button" onClick={() => setEditing((e) => !e)} data-testid="home-shortcut-toggle-edit"
          aria-pressed={editing} className="px-2 py-1 text-[11px] font-semibold text-v3-text-body">
          {editing ? 'เสร็จสิ้น' : 'แก้ไขทางลัด'}
        </button>
      </div>

      {/* ชีตเลือกทางลัด — ผ่าน OverlayPortal เพราะแถบเมนูล่างของหน้าหลักเป็น fixed z-40 (ดูหมายเหตุใน kit.tsx) */}
      {slot !== null && (
        <OverlayPortal>
          <SheetShell label="เลือกทางลัด" onClose={() => setSlot(null)}>
            <h2 className="text-[18px] font-bold leading-7 text-v3-navy">ทางลัดช่องที่ {slot + 1}</h2>
            <ul className="mt-3 flex max-h-[50vh] flex-col gap-1 overflow-y-auto" data-testid="home-shortcut-picker">
              {SHORTCUT_CATALOG.map((s) => (
                <li key={s.key}>
                  <button type="button" onClick={() => pick(slot, s.key)} data-testid={`home-shortcut-pick-${s.key}`}
                    className="flex w-full items-center gap-3 rounded-[16px] bg-white px-4 py-3 text-left">
                    <span aria-hidden className="text-[20px] leading-6">{s.icon}</span>
                    <span className="text-[14px] font-bold text-v3-navy">{s.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </SheetShell>
        </OverlayPortal>
      )}
    </div>
  )
}

export default ShortcutBar

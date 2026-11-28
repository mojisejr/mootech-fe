// features/v2-friends/components/FriendsListScreen.tsx — จอ "เพื่อนของฉัน" (/v2/friends · ประชุม 24 พ.ย. ข้อ 3)
// เฟรม `friends-01-list`: หัวจอ → การ์ดเป้า 5 ธาตุ → ค้นหา → รายชื่อเพื่อน
//
// ข้อมูลมาจากที่ที่มีอยู่แล้วทั้งหมด ไม่มี API ใหม่:
//   • รายชื่อ    GET /api/member-with-friend — โปรไฟล์วันเกิดที่ผู้ใช้บันทึกไว้เพื่อดูดวงสมพงศ์ (array เปล่า)
//   • เป้า 5 ธาตุ  GET /api/missions goals.element — นับจาก "เพื่อนที่ชวนมา" (คนละกลุ่มกับรายชื่อ)
//   • จำนวนชวนมา  GET /api/referral
//
// ที่ตั้งใจไม่ทำในรอบแรก (flag ไว้ตามรอบสองของใบงาน):
//   • "คู่ชะตา 93%" ท้ายแถวในเฟรม — ไม่มีข้อมูลคะแนนรายคน (ประวัติดวงสมพงศ์เก็บแค่ชื่อ ไม่มี id ของแถวเพื่อน)
//     จะต้องให้ผลการคำนวณเก็บ id ของเพื่อนไว้ก่อน จึงจะโชว์ได้โดยไม่ปั้นตัวเลข
//   • ชิปกรองตามธาตุของเพื่อนแต่ละคน — รายการไม่มีธาตุรายคน (ต้องคำนวณรายคน)
//   • ชีตจัดการ: รอบแรกมีแค่ "ลบเพื่อน" ซ่อน/บล็อก/รายงานต้องมีตารางใหม่
//   • แก้ไขข้อมูลเพื่อน — ทำได้จากหน้าดูดวงคู่ (ชีตเพิ่มเพื่อนโหมดแก้ไข) อยู่แล้ว
// แตะตัวแถว → หน้าดูดวงเพื่อน (ข้อ 2 · FriendFortuneScreen) · ปุ่ม "···" → ชีตจัดการ (ลบ)
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Menubar } from "@/features/v2-shell/components/Menubar"
import { SheetShell, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import type { MissionBoard, Referral } from "@/features/v2-qi/qi-model"
import { ElementGoalCard } from "./ElementGoalCard"
import { Portal } from "./Portal"
import { filterFriends, friendBirthText, friendInitial, friendName, parseFriendRows, type FriendRow } from "../friends-model"

export const FRIENDS_REFERRAL_HREF = "/v2/qi/referral"
/** ทางเข้าเพิ่มเพื่อนของรอบแรก: หน้าดูดวงเพื่อนร่วมงาน (ชีตเพิ่มเพื่อนอยู่ที่นั่น) */
export const FRIENDS_COMPAT_HREF = "/v2/service/compatibility/colleague"
/** แตะแถว → หน้าดูดวงเพื่อนคนนั้น (ข้อ 2) */
export const friendFortuneHref = (id: string) => `/v2/friends/${encodeURIComponent(id)}`
const TOAST_MS = 3000

function FriendAvatar({ f, size = 40 }: { f: FriendRow; size?: number }) {
  const pic = (f.picture_url ?? "").trim()
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white"
      style={{ width: size, height: size }}
    >
      {pic ? <Image src={pic} alt="" fill sizes={`${size}px`} style={{ objectFit: "cover" }} /> : <span>{friendInitial(f)}</span>}
    </span>
  )
}

const SEARCH_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9EA8B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
const MORE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#9EA8B8" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
)

export function FriendsListScreen() {
  // null = ยังไม่รู้ (กำลังโหลด / โหลดไม่สำเร็จ) — "ว่างจริง" คือ [] เสมอ ไม่ปนกับความล้มเหลว
  const [rows, setRows] = useState<FriendRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [collectedKeys, setCollectedKeys] = useState<ReadonlySet<string> | null>(null)
  const [invited, setInvited] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [manage, setManage] = useState<FriendRow | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Idempotent effect (alive guard, no latch): รายชื่อวาดทันทีที่มา ไม่รอกระเป๋า/เป้า (engine ช้ากว่า) —
  // เป้ากับจำนวนชวนมาเป็นของประดับ โหลดพลาดก็แค่ไม่โชว์ ไม่ทำให้รายชื่อหาย
  useEffect(() => {
    let alive = true
    const read = (x: Response) => (x.ok ? x.json() : Promise.reject(new Error(String(x.status))))
    const listReq = fetch("/api/member-with-friend").then(read).then(parseFriendRows).catch(() => null)
    const boardReq = fetch("/api/missions").then(read).catch(() => null) as Promise<MissionBoard | null>
    const referralReq = fetch("/api/referral").then(read).catch(() => null) as Promise<Referral | null>
    void (async () => {
      const list = await listReq
      if (!alive) return
      if (list === null) setFailed(true)
      else setRows(list)
      const [board, referral] = await Promise.all([boardReq, referralReq])
      if (!alive) return
      const elements = board?.goals?.element.elements
      if (Array.isArray(elements)) setCollectedKeys(new Set(elements.filter((e) => e?.collected).map((e) => e.key)))
      const n = board?.goals?.referral.invited ?? referral?.invitedCount
      setInvited(typeof n === "number" && Number.isFinite(n) ? n : null)
    })()
    return () => {
      alive = false
    }
  }, [attempt])

  const closeManage = useCallback(() => {
    setManage(null)
    setConfirming(false)
    setDeleteError(false)
  }, [])

  // ปิดชีตด้วย Escape (แบบเดียวกับ AddFriendSheet) — รับฟังเฉพาะตอนชีตเปิด และไม่ปิดกลางคันระหว่างลบ
  const manageOpen = manage !== null
  useEffect(() => {
    if (!manageOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) closeManage()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [manageOpen, deleting, closeManage])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(t)
  }, [toast])

  async function confirmDelete() {
    const target = manage
    if (!target || deleting) return
    setDeleting(true)
    setDeleteError(false)
    let ok = false
    try {
      // scope คือ session ของผู้เรียก + id แถว (server ไม่รับ user_id ของคนอื่น) — ส่ง id อย่างเดียวพอ
      const res = await fetch(`/api/member-with-friend?id=${encodeURIComponent(target.id)}`, { method: "DELETE" })
      ok = res.ok
    } catch {
      ok = false
    }
    setDeleting(false)
    if (!ok) {
      setDeleteError(true)
      return
    }
    setRows((prev) => (prev ? prev.filter((f) => f.id !== target.id) : prev))
    closeManage()
    setToast("ลบเพื่อนแล้ว")
  }

  const shown = rows ? filterFriends(rows, query) : []
  const searching = query.trim().length > 0

  return (
    <SkyScreen menubar={<Menubar />}>
      <Head><title>เพื่อนของฉัน · MuMate</title></Head>
      <SkyHeader title="เพื่อนของฉัน" testId="friends" />

      {/* เป้า 5 ธาตุ (เพื่อนที่ชวนมา) + ทางไปชวนเพื่อน — โชว์เมื่อรู้เป้าเท่านั้น ไม่วาดการ์ดว่าง ๆ แล้วให้เดา */}
      {collectedKeys && (
        <div className="mt-3">
          <ElementGoalCard collectedKeys={collectedKeys} testId="friends-element-goal" />
        </div>
      )}
      <Link href={FRIENDS_REFERRAL_HREF} data-testid="friends-invite" className="mt-3 flex items-center gap-3 rounded-[18px] bg-v3-sapphire px-4 py-3">
        <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-white/15 text-[20px] font-bold leading-none text-v3-lime">+</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold leading-5 text-white">ชวนเพื่อนเข้า MuMate</span>
          <span className="block text-[11px] leading-4 text-white/80">
            {invited !== null ? `ชวนมาแล้ว ${invited.toLocaleString("th-TH")} คน · ` : ""}รับ QI ทุกคนที่กรอกโค้ดของคุณ
          </span>
        </span>
        <span aria-hidden className="flex-none text-[16px] font-bold leading-6 text-v3-lime">›</span>
      </Link>

      {/* ค้นหา — โชว์เมื่อมีรายชื่อให้ค้น */}
      {rows && rows.length > 0 && (
        <div className="mt-4 flex h-11 items-center gap-2 rounded-full border border-v3-border-input bg-white pl-4 pr-2">
          {SEARCH_ICON}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อเพื่อน"
            aria-label="ค้นหาชื่อเพื่อน"
            data-testid="friends-search"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-v3-text-filled outline-none placeholder:text-v3-placeholder"
          />
          {searching && (
            <button type="button" onClick={() => setQuery("")} aria-label="ล้างคำค้น" data-testid="friends-search-clear"
              className="grid size-8 flex-none place-items-center rounded-full bg-v3-ghost-white text-v3-text-body">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-v3-navy">{searching ? "ผลการค้นหา" : "รายชื่อเพื่อน"}</h2>
        {rows && !searching && (
          <span data-testid="friends-count" className="text-[12px] font-semibold text-v3-text-body">{rows.length.toLocaleString("th-TH")} คน</span>
        )}
      </div>

      {rows === null && !failed && (
        <div className="mt-2 flex flex-col gap-2" data-testid="friends-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-[18px] border border-v3-border-card bg-white px-3 py-3">
              <div className="size-10 animate-pulse rounded-full bg-v3-sky-tint" />
              <div className="flex-1">
                <div className="h-3.5 w-28 animate-pulse rounded bg-v3-sky-tint" />
                <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-v3-sky-tint/70" />
              </div>
            </div>
          ))}
        </div>
      )}

      {failed && rows === null && (
        <div className="v3-shadow-card mt-2 rounded-[24px] bg-white p-5 text-center" data-testid="friends-error">
          <p className="text-[14px] font-bold text-v3-navy">โหลดรายชื่อไม่สำเร็จ</p>
          <button type="button" onClick={() => { setFailed(false); setAttempt((a) => a + 1) }} data-testid="friends-retry"
            className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-v3-lime">ลองใหม่</button>
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="v3-shadow-card mt-2 rounded-[24px] bg-white p-6 text-center" data-testid="friends-empty">
          <p className="text-[15px] font-bold text-v3-navy">ยังไม่มีเพื่อนในรายชื่อ</p>
          <p className="mt-1 text-[12px] leading-[18px] text-v3-text-body">
            เพิ่มเพื่อนได้จากหน้าดูดวงคู่ แล้วชื่อจะมาโผล่ที่นี่ หรือชวนเพื่อนเข้า MuMate เพื่อสะสมครบ 5 ธาตุ
          </p>
          <Link href={FRIENDS_COMPAT_HREF} data-testid="friends-empty-compat"
            className="mt-4 grid h-11 place-items-center rounded-full bg-v3-sapphire text-sm font-bold text-v3-lime">ไปดูดวงกับเพื่อน</Link>
        </div>
      )}

      {rows && shown.length === 0 && searching && (
        <div className="v3-shadow-card mt-2 rounded-[24px] bg-white p-6 text-center" data-testid="friends-no-match">
          <p className="text-[14px] font-bold text-v3-navy">ไม่พบเพื่อนที่ชื่อ {query.trim()}</p>
          <button type="button" onClick={() => setQuery("")} data-testid="friends-no-match-clear"
            className="mt-3 text-[13px] font-bold text-v3-sapphire">ล้างคำค้น</button>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2" data-testid="friends-list">
          {shown.map((f) => {
            const birth = friendBirthText(f)
            return (
              <li key={f.id} className="flex items-center gap-1">
                {/* แตะตัวแถว → หน้าดูดวงเพื่อน (ข้อ 2) · ปุ่ม "···" → ชีตจัดการ (ลบ) */}
                <Link href={friendFortuneHref(f.id)} data-testid={`friends-row-${f.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-v3-border-card bg-white px-3 py-3 text-left">
                  <FriendAvatar f={f} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold leading-5 text-v3-navy">{friendName(f)}</span>
                    {birth && <span className="block truncate text-[12px] leading-[18px] text-v3-text-body">{birth}</span>}
                  </span>
                  {f.is_disable && <span className="flex-none text-[12px] font-medium text-v3-text-muted">เลือกไม่ได้</span>}
                  <span aria-hidden className="flex-none text-[16px] font-bold leading-6 text-v3-text-note">›</span>
                </Link>
                <button type="button" onClick={() => { setConfirming(false); setDeleteError(false); setManage(f) }} data-testid={`friends-manage-open-${f.id}`}
                  aria-label={`จัดการเพื่อน ${friendName(f)}`}
                  className="grid size-10 flex-none place-items-center rounded-full text-v3-text-body">
                  {MORE_ICON}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* ชีตจัดการ — รอบแรกมี "ลบเพื่อน" อย่างเดียว (ซ่อน/บล็อก/รายงาน รอบสอง) · portal ไป body (ดู Portal) */}
      {manage && (
        <Portal>
        <SheetShell label="จัดการเพื่อน" onClose={() => !deleting && closeManage()}>
          <div className="flex items-center gap-3" data-testid="friends-manage">
            <FriendAvatar f={manage} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-bold leading-6 text-v3-navy" data-testid="friends-manage-name">{friendName(manage)}</p>
              {friendBirthText(manage) && <p className="truncate text-[12px] leading-[18px] text-v3-text-body">{friendBirthText(manage)}</p>}
            </div>
          </div>

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} data-testid="friends-manage-delete"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-v3-border-dropdown bg-white text-[15px] font-bold text-v3-error">
              ลบเพื่อน
            </button>
          ) : (
            <div className="flex flex-col gap-3" data-testid="friends-manage-confirm">
              <p className="text-center text-[15px] font-bold leading-5 text-v3-navy">ลบเพื่อนคนนี้?</p>
              <p className="text-center text-[13px] leading-5 text-v3-text-body">ข้อมูลของ {friendName(manage)} จะถูกลบ กู้คืนไม่ได้</p>
              {deleteError && <p role="alert" data-testid="friends-manage-error" className="text-center text-[13px] font-medium text-v3-error">ลบไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirming(false)} disabled={deleting} data-testid="friends-manage-cancel"
                  className="flex-1 rounded-full border border-v3-border-dropdown py-3 text-[15px] font-bold text-v3-navy disabled:opacity-50">ยกเลิก</button>
                <button type="button" onClick={() => void confirmDelete()} disabled={deleting} data-testid="friends-manage-confirm-delete"
                  className="flex-1 rounded-full bg-v3-error py-3 text-[15px] font-bold text-white disabled:opacity-60">{deleting ? "กำลังลบ…" : "ลบเพื่อน"}</button>
              </div>
            </div>
          )}
        </SheetShell>
        </Portal>
      )}

      {toast && (
        <Portal>
          <div role="status" data-testid="friends-toast"
            className="fixed inset-x-0 bottom-28 z-[60] mx-auto w-max max-w-[90vw] rounded-full bg-v3-navy px-5 py-2.5 text-[13px] font-bold text-white">
            {toast}
          </div>
        </Portal>
      )}
    </SkyScreen>
  )
}

export default FriendsListScreen

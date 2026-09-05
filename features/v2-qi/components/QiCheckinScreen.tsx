// features/v2-qi/components/QiCheckinScreen.tsx — จอ "เช็คอินรายวัน" เต็ม (/v2/qi/checkin)
// เฟรม `check-in — states` (55399:5535) + `check-in — reward moments` (55399:5704). ดีไซน์ = การ์ดเดียวจบ:
// หัว "เช็คอินต่อเนื่อง n/7 วัน" + strip 7 วัน + ปุ่มหลัก navy เต็มกว้าง + แคปชันโบนัส +30 QI.
// สถานะ A พร้อมเช็คอิน · B เช็คแล้ววันนี้ · C ครบ 7 วัน (celebration sheet) · D สตรีคขาด (banner) · E ผู้ใช้ใหม่.
// ข้อมูลจริงทั้งหมดจาก engine (ประวัติ daily_login + ค่า +N จาก catalog) — คิดวันแบบ Asia/Bangkok เท่านั้น
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { KitButton, SectionCard, SheetShell, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { checkedInToday, checkinStreak, todayBangkok, checkedInDays, dayBefore, type QiCatalog, type Wallet } from "../qi-model"

const WEEK_BONUS = 30 // โบนัสครบ 7 วัน (engine เป็นผู้ให้จริง — ค่านี้ใช้แสดงผล; ต่อ catalog ภายหลังได้)

/** 7 วันย้อนหลัง (เก่า → ใหม่) แบบ Bangkok สำหรับ strip */
function last7Days(today: string): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" })
  const days: string[] = []
  let cursor = today
  for (let i = 0; i < 7; i += 1) {
    days.unshift(cursor)
    const [y, m, d] = cursor.split("-").map(Number)
    cursor = fmt.format(new Date(Date.UTC(y, m - 1, d - 1, 12)))
  }
  return days
}

export function QiCheckinScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [dailyQi, setDailyQi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [busy, setBusy] = useState(false)
  const [justClaimed, setJustClaimed] = useState(false)
  const [toast, setToast] = useState<{ title: string; sub?: string } | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([fetch("/api/qi-wallet"), fetch("/api/qi-catalog")])
      if (w.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (w.ok) setWallet(await w.json())
      if (c.ok) {
        const cat = (await c.json()) as QiCatalog
        setDailyQi(cat.earn.find((l) => l.code === "daily_login")?.qi ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const today = todayBangkok()
  const days = last7Days(today)
  const claimed = checkedInDays(wallet?.history)
  const done = justClaimed || checkedInToday(wallet?.history, today)
  const streak = checkinStreak(wallet?.history, today)
  const qi = dailyQi ?? 5

  const isNew = claimed.size === 0 && !justClaimed
  const weekProgress = streak === 0 ? 0 : ((streak - 1) % 7) + 1
  const weekComplete = done && streak > 0 && streak % 7 === 0
  const broke = !done && streak === 0 && claimed.size > 0
  // กู้คืนได้เมื่อ "เมื่อวาน" ขาด แต่ "วันก่อนเมื่อวาน" เคยเช็คอิน (ช่องว่าง 1 วันที่ตัดสตรีค)
  const yesterday = dayBefore(today)
  const canRestore = !done && !claimed.has(yesterday) && claimed.has(dayBefore(yesterday))
  // จำนวนวันสตรีคที่จะเสียถ้าไม่กู้คืน — นับวันเช็คอินต่อเนื่องก่อนช่องว่าง (สำหรับ banner สถานะ D)
  const lostStreak = (() => {
    if (!canRestore) return 0
    let n = 0
    let cur = dayBefore(yesterday)
    while (claimed.has(cur)) { n += 1; cur = dayBefore(cur) }
    return n
  })()

  const restore = async () => {
    setRestoring(true)
    setRestoreMsg(null)
    try {
      const res = await fetch("/api/qi-streak-restore", { method: "POST" })
      if (res.ok) {
        setToast({ title: "กู้คืนสตรีคแล้ว", sub: "เช็คอินวันนี้เพื่อไปต่อ" })
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(null), 2600)
        await load()
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setRestoreMsg(String(j.error ?? "กู้คืนไม่สำเร็จ"))
      }
    } finally {
      setRestoring(false)
    }
  }

  const checkin = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/qi-earn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "daily_login" }),
      })
      if (res.ok) {
        setJustClaimed(true)
        const newStreak = streak + 1
        const completedWeek = newStreak % 7 === 0
        if (completedWeek) {
          setCelebrate(true)
        } else {
          const remain = 7 - (((newStreak - 1) % 7) + 1)
          setToast({
            title: `ได้รับ +${qi} QI แล้ว`,
            sub: remain > 0
              ? `เช็คอินต่อเนื่อง ${newStreak} วัน · อีก ${remain} วันรับ +${WEEK_BONUS} QI`
              : `เช็คอินต่อเนื่อง ${newStreak} วัน`,
          })
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToast(null), 2600)
        }
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const caption = done
    ? weekComplete
      ? `รับโบนัสครบสัปดาห์แล้ว +${WEEK_BONUS} QI`
      : `อีก ${7 - weekProgress} วันรับโบนัส +${WEEK_BONUS} QI`
    : `ครบ 7 วันติดรับโบนัส +${WEEK_BONUS} QI`

  return (
    <SkyScreen>
      <Head><title>เช็คอินรายวัน · MuMate</title></Head>
      <SkyHeader title="เช็คอินรายวัน" testId="qi-checkin-screen" />

      {loading && (
        <div className="mt-3" data-testid="qi-checkin-loading">
          <div className="h-[240px] w-full animate-pulse rounded-[28px] bg-v3-sapphire/20" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="qi-checkin-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {!loading && !guard && (
        <div className="mt-3 flex flex-col gap-4">
          {/* การ์ดเช็คอินเดียวจบ (เฟรม check-in — states) */}
          <SectionCard>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-black text-v3-navy">เช็คอินต่อเนื่อง</p>
              <p className="text-[12px] font-bold text-v3-text-muted">
                {isNew ? "เริ่มสัปดาห์แรก" : (<><span data-testid="qi-checkin-streak">{weekProgress}</span> / 7 วัน</>)}
              </p>
            </div>

            {/* สถานะ D — สตรีคขาด (เฟรม recovery-banner): กู้คืน 20 QI ได้ถ้าขาด 1 วัน (สัปดาห์ละครั้ง) */}
            {(canRestore || broke) && (
              <div className="mt-3 flex items-center gap-2.5 rounded-[12px] bg-[#FBECEC] px-3 py-2.5" data-testid="qi-checkin-recovery">
                <p className="min-w-0 flex-1 text-[12px] leading-[18px] text-[#A83238]">
                  {canRestore ? `ขาดไป 1 วัน สถิติ ${lostStreak} วันถูกรีเซ็ต` : "สตรีคขาด — เช็คอินวันนี้เริ่มนับใหม่"}
                </p>
                {canRestore && (
                  <button
                    onClick={() => void restore()}
                    disabled={restoring}
                    data-testid="qi-checkin-restore"
                    className="flex-none rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#A83238] disabled:opacity-50"
                  >
                    {restoring ? "..." : "กู้คืน 20 QI"}
                  </button>
                )}
              </div>
            )}
            {restoreMsg && <p data-testid="qi-checkin-restore-msg" className="mt-1 text-[11px] font-bold text-v3-error">{restoreMsg}</p>}

            {/* strip 7 วัน */}
            <div className="mt-3 flex items-stretch gap-1.5" data-testid="qi-checkin-strip">
              {days.map((d, i) => {
                const isDone = claimed.has(d) || (justClaimed && d === today)
                const isToday = d === today
                const dayNum = Number(d.slice(8, 10))
                const gift = isDone && i === 6 && weekComplete
                return (
                  <span
                    key={d}
                    data-testid={`qi-checkin-day-${d}`}
                    className={
                      "grid flex-1 place-items-center rounded-[11px] py-3 text-[13px] font-black " +
                      (isDone
                        ? "bg-[#ECF0FD] text-v3-sapphire"
                        : isToday
                          ? "bg-v3-cyan text-white"
                          : "bg-[#F0F8F0] text-v3-cyan")
                    }
                  >
                    {gift ? "🎁" : isDone ? "✓" : dayNum}
                  </span>
                )
              })}
            </div>

            {/* ปุ่มหลัก navy เต็มกว้าง — สถานะ A/B/C/E */}
            <div className="mt-4">
              {done && !weekComplete ? (
                <KitButton variant="ghost" disabled testId="qi-checkin-btn" className="!bg-[#FBF1F2] !h-12 !text-v3-text-muted">
                  เช็คอินแล้ว · กลับมาพรุ่งนี้
                </KitButton>
              ) : weekComplete ? (
                <KitButton onClick={() => setCelebrate(true)} testId="qi-checkin-btn">
                  รับโบนัสครบสัปดาห์ +{WEEK_BONUS} QI
                </KitButton>
              ) : (
                <KitButton onClick={() => void checkin()} disabled={busy} testId="qi-checkin-btn">
                  {busy ? "กำลังบันทึก..." : isNew ? `เริ่มเช็คอินวันแรก รับ +${qi} QI` : `เช็คอินวันนี้ รับ +${qi} QI`}
                </KitButton>
              )}
            </div>

            <p className="mt-2 text-center text-[11px] leading-4 text-v3-text-muted">{caption}</p>

            {/* สถานะข้อความ (คงคีย์เดิม qi-checkin-hero ให้เทสต์อ้างอิงสถานะ) */}
            <p className="mt-1 text-center text-[11px] leading-4 text-v3-text-muted" data-testid="qi-checkin-hero">
              {done ? "วันนี้เช็คอินแล้ว — กลับมาใหม่พรุ่งนี้" : "มาเช็คอินวันนี้เพื่อคุมสตรีคต่อ"}
            </p>
          </SectionCard>

          <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
            ลืมเช็คอินวันหนึ่ง สตรีคจะเริ่มนับใหม่ — เปิดแอปทุกวันเพื่อสะสมให้ต่อเนื่อง
          </p>
        </div>
      )}

      {/* toast รับ QI (เฟรม reward moments) — เหรียญ + 2 บรรทัด */}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-md px-6" data-testid="qi-checkin-toast">
          <div className="flex items-center gap-3 rounded-[16px] bg-v3-navy/95 px-4 py-3 text-left text-white shadow-lg">
            <Image src="/images/v2/qi/qi-coin.png" alt="" width={32} height={32} className="size-8 flex-none rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-5">{toast.title}</p>
              {toast.sub ? <p className="text-[11px] leading-4 text-white/80">{toast.sub}</p> : null}
            </div>
          </div>
        </div>
      )}

      {/* celebration ครบ 7 วัน (เฟรม reward moments) */}
      {celebrate && (
        <SheetShell label="ครบ 7 วัน" onClose={() => setCelebrate(false)}>
          <div className="flex flex-col items-center gap-2 text-center">
            <span aria-hidden className="grid size-16 place-items-center rounded-full bg-[#FBF3DE] text-[24px] font-black text-[#B8892B]">+{WEEK_BONUS}</span>
            <h2 className="text-[20px] font-black text-v3-navy">ครบ 7 วันแล้ว! 🎉</h2>
            <p className="text-[13px] leading-5 text-v3-text-muted">
              รับโบนัส +{WEEK_BONUS} QI เข้ากระเป๋าแล้ว
              {typeof wallet?.qi === "number" ? ` · ยอดรวมตอนนี้ ${wallet.qi.toLocaleString("th-TH")} QI` : ""}
            </p>
            {/* strip 7 วัน ครบ ✓ ทั้งแถว */}
            <div className="mt-3 flex w-full items-stretch gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className="grid flex-1 place-items-center rounded-[11px] bg-[#ECF0FD] py-2.5 text-[13px] font-black text-v3-sapphire">✓</span>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2">
            <KitButton href="/v2/qi" testId="qi-checkin-celebrate-cta">ใช้ QI ถามเซียนมูเลย</KitButton>
            <KitButton variant="ghost" onClick={() => setCelebrate(false)}>เริ่มสัปดาห์ใหม่พรุ่งนี้</KitButton>
          </div>
        </SheetShell>
      )}
    </SkyScreen>
  )
}

export default QiCheckinScreen

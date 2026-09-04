// features/v2-qi/components/QiCheckinScreen.tsx — จอ "เช็คอินรายวัน" เต็ม (/v2/qi/checkin)
// เฟรม `check-in — reward moments` + `check-in — states`. Reskin 2026-09-04: การ์ดสตรีคน้ำเงินใหญ่ +
// strip 7 วันเป็น "เหรียญ" วงกลมใหญ่ (วันที่ผ่าน = เหรียญทอง✓ · วันนี้ = ขอบไฮไลต์ · อนาคต = เทา).
// ข้อมูลจริงทั้งหมดจาก engine (ประวัติ daily_login + ค่า +5 จาก catalog) — คิดวันแบบ Asia/Bangkok เท่านั้น
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { SectionCard, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { checkedInToday, checkinStreak, todayBangkok, checkedInDays, type QiCatalog, type Wallet } from "../qi-model"

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
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const today = todayBangkok()
  const days = last7Days(today)
  const claimed = checkedInDays(wallet?.history)
  const done = justClaimed || checkedInToday(wallet?.history, today)
  const streak = checkinStreak(wallet?.history, today)

  return (
    <SkyScreen>
      <Head><title>เช็คอินรายวัน · MuMate</title></Head>
      <SkyHeader title="เช็คอินรายวัน" testId="qi-checkin-screen" />

      {loading && (
        <div className="mt-3" data-testid="qi-checkin-loading">
          <div className="h-[190px] w-full animate-pulse rounded-[28px] bg-v3-sapphire/20" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="qi-checkin-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {!loading && !guard && (
        <div className="mt-3 flex flex-col gap-4">
          {/* hero สตรีค — การ์ดน้ำเงินใหญ่พร้อมเหรียญ (เฟรม check-in — reward moments) */}
          <section className="relative overflow-hidden rounded-[28px] bg-v3-sapphire p-6 text-white" data-testid="qi-checkin-hero">
            <span aria-hidden className="v3-float-wide absolute -right-2 -top-2 block size-[96px] opacity-90">
              <Image src="/images/v2/zone2/coin.png" alt="" width={96} height={96} unoptimized className="size-full object-contain" />
            </span>
            <p className="text-[12px] leading-4 text-white/75">เช็คอินต่อเนื่อง</p>
            <p className="text-[44px] font-black leading-[52px]" data-testid="qi-checkin-streak">
              {streak} <span className="text-[16px] font-bold">วัน</span>
            </p>
            <p className="mt-1 text-[12px] leading-4 text-white/85">
              {done ? "วันนี้เช็คอินแล้ว — กลับมาใหม่พรุ่งนี้" : "มาเช็คอินวันนี้เพื่อคุมสตรีคต่อ"}
            </p>
          </section>

          {/* strip 7 วันแบบ "เหรียญ" (เฟรม check-in — states) */}
          <SectionCard>
            <div className="flex items-center justify-between gap-1" data-testid="qi-checkin-strip">
              {days.map((d) => {
                const isDone = claimed.has(d)
                const isToday = d === today
                const dayNum = Number(d.slice(8, 10))
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1">
                    {isDone ? (
                      // วันที่เช็คอินแล้ว = เหรียญทองมี ✓
                      <span
                        data-testid={`qi-checkin-day-${d}`}
                        className="grid size-[46px] place-items-center rounded-full bg-gradient-to-b from-[#FFD54F] to-[#FFB300] text-[15px] font-black text-white shadow-[0_2px_8px_rgba(255,179,0,.45)]"
                      >
                        ✓
                      </span>
                    ) : isToday ? (
                      // วันนี้ = ขอบไฮไลต์รอเหรียญ
                      <span
                        data-testid={`qi-checkin-day-${d}`}
                        className="grid size-[46px] place-items-center rounded-full border-[3px] border-v3-cyan bg-v3-ghost-white text-[14px] font-black text-v3-cyan"
                      >
                        {dayNum}
                      </span>
                    ) : (
                      // อนาคต = เทา
                      <span
                        data-testid={`qi-checkin-day-${d}`}
                        className="grid size-[46px] place-items-center rounded-full bg-v3-ghost-white text-[14px] font-bold text-v3-text-muted"
                      >
                        {dayNum}
                      </span>
                    )}
                    <span className={"text-[10px] " + (isToday ? "font-black text-v3-cyan" : "text-v3-text-muted")}>
                      {isToday ? "วันนี้" : ""}
                    </span>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* ปุ่มเช็คอิน — สถานะตามเฟรม states */}
          <SectionCard className="!p-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-11 flex-none place-items-center rounded-[14px] bg-[#E3F2FD] text-[20px]">📅</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-v3-navy">เช็คอินวันนี้</p>
                <p className="text-[11px] leading-4 text-v3-text-muted">รับ +{dailyQi ?? 5} ชี่ (วันละ 1 ครั้ง)</p>
              </div>
              <button
                onClick={() => void checkin()}
                disabled={done || busy}
                data-testid="qi-checkin-btn"
                className={
                  (done ? "bg-v3-disabled-bg text-v3-text-muted" : "bg-v3-cyan text-white") +
                  " grid h-10 flex-none place-items-center rounded-full px-4 text-[12px] font-bold transition disabled:cursor-default"
                }
              >
                {done ? "เช็คอินแล้ว ✓" : busy ? "..." : "เช็คอิน"}
              </button>
            </div>
          </SectionCard>

          <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
            ลืมเช็คอินวันหนึ่ง สตรีคจะเริ่มนับใหม่ — เปิดแอปทุกวันเพื่อสะสมให้ต่อเนื่อง
          </p>
        </div>
      )}
    </SkyScreen>
  )
}

export default QiCheckinScreen

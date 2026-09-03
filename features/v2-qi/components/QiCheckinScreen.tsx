// features/v2-qi/components/QiCheckinScreen.tsx — จอ "เช็คอินรายวัน" เต็ม (/v2/qi/checkin)
// เฟรม `check-in — reward moments` + `check-in — states`.
//
// ข้อมูลจริงทั้งหมดจาก engine: ประวัติ daily_login (wallet history) + ค่า +5 จาก /api/qi-catalog.
// สถานะตามเฟรม: ก่อนเช็คอิน (ปุ่มเปิด) · เช็คอินแล้ววันนี้ (ปุ่มปิด ✓) · สตรีคหลุด (แถบวันว่าง).
// ❌ สตรีค/วันที่คิดฝั่งจอจากประวัติเขต Asia/Bangkok เท่านั้น — engine ยังไม่มี endpoint สตรีค
// (bazi_qi_claim กันซ้ำแล้ว จอไม่ใช่ด่าน)
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { QiHeader } from "./QiHeader"
import { checkedInToday, checkinStreak, todayBangkok, checkedInDays, type QiCatalog, type Wallet } from "../qi-model"

const CARD = "v3-shadow-card w-full rounded-[20px] bg-white p-5"

/** 7 วันย้อนหลัง (เก่า → ใหม่) แบบ Bangkok สำหรับ strip */
function last7Days(today: string): string[] {
  const days: string[] = []
  let cursor = today
  for (let i = 0; i < 7; i += 1) {
    days.unshift(cursor)
    const [y, m, d] = cursor.split("-").map(Number)
    cursor = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(Date.UTC(y, m - 1, d - 1, 12)),
    )
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
    <div className="font-ibm min-h-[100dvh] w-full bg-white pb-10">
      <div className="mx-auto w-full max-w-md px-4">
        <QiHeader title="เช็คอินรายวัน" testId="qi-checkin-screen" />

        {loading && (
          <div className="mt-3" data-testid="qi-checkin-loading">
            <div className="h-[150px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="qi-checkin-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {!loading && !guard && (
          <div className="mt-3 flex flex-col gap-4">
            {/* hero สตรีค */}
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="qi-checkin-hero">
              <p className="text-[12px] leading-4 text-white/80">เช็คอินต่อเนื่อง</p>
              <p className="text-[34px] font-black leading-10" data-testid="qi-checkin-streak">
                {streak} <span className="text-[16px] font-bold">วัน</span>
              </p>
              <p className="mt-1 text-[12px] leading-4 text-white/85">
                {done ? "วันนี้เช็คอินแล้ว — กลับมาใหม่พรุ่งนี้" : "มาเช็คอินวันนี้เพื่อคุมสตรีคต่อ"}
              </p>
            </section>

            {/* strip 7 วัน — วันที่เช็คอินแล้วมี ✓ */}
            <section className={CARD} data-testid="qi-checkin-strip">
              <div className="flex items-center justify-between gap-1">
                {days.map((d) => {
                  const isDone = claimed.has(d)
                  const dayNum = Number(d.slice(8, 10))
                  return (
                    <div key={d} className="flex flex-1 flex-col items-center gap-1">
                      <span
                        aria-hidden
                        data-testid={`qi-checkin-day-${d}`}
                        className={
                          (isDone ? "bg-v3-cyan text-white" : "bg-v3-ghost-white text-v3-text-muted") +
                          " grid size-9 place-items-center rounded-full text-[13px] font-bold"
                        }
                      >
                        {isDone ? "✓" : dayNum}
                      </span>
                      <span className="text-[10px] text-v3-text-muted">{d.slice(8, 10) === today.slice(8, 10) && d === today ? "วันนี้" : ""}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ปุ่มเช็คอิน — สถานะตามเฟรม states */}
            <section className={CARD}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-v3-ghost-white text-[18px]" aria-hidden>
                  📅
                </span>
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
            </section>

            <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
              ลืมเช็คอินวันหนึ่ง สตรีคจะเริ่มนับใหม่ — เปิดแอปทุกวันเพื่อสะสมให้ต่อเนื่อง
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default QiCheckinScreen

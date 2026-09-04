// features/v2-qi/components/QiHistoryScreen.tsx — จอ "ประวัติ QI" เต็ม (/v2/qi/history) — ก้อน 1.3.
//
// Design: Figma frame `qi-history — all` (55399:6809): ตัวเลือกเดือน + การ์ดสรุป 3 ค่า (ได้รับ/ใช้ไป/คงเหลือ)
// + แท็บ ทั้งหมด/ได้รับ/ใช้ไป + รายการจัดกลุ่มตามวัน (ไอคอน + เวลา + ป้าย ± + ยอดคงเหลือหลังรายการ).
// ข้อมูลจาก GET /api/qi-wallet?history=100 (engine เพดาน 100) + GET /api/missions เพื่อแปลง mission:<id>.
// ❌ การอ่านล้มต้องไม่ถูก render เป็น "ยังไม่มีรายการ" — สถานะ error แยกจาก empty (บทเรียน #365).
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"

import { AmountPill, IconTile, KitButton, SkyScreen } from "@/features/v2-profile/components/kit"
import { QiHeader } from "./QiHeader"
import { bangkokDay, reasonLabel, todayBangkok, type MissionBoard, type Wallet, type WalletHistoryRow } from "../qi-model"

/** เวลา HH:MM เขตกรุงเทพจาก ISO */
function bangkokTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
}
/** คีย์เดือน YYYY-MM เขตกรุงเทพ */
const monthKey = (iso: string) => bangkokDay(iso).slice(0, 7)
/** ป้ายเดือนไทย เช่น "ส.ค. 2569" (พ.ศ.) จากคีย์ YYYY-MM */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("th-TH", { month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15, 5)))
}
/** ป้ายหัวกลุ่มวัน: วันนี้ / เมื่อวาน / วันที่ไทย */
function dayHeader(dayKey: string, today: string): string {
  if (dayKey === today) return "วันนี้"
  const [y, m, d] = today.split("-").map(Number)
  const yest = bangkokDay(new Date(Date.UTC(y, m - 1, d - 1, 12)))
  const [yy, mm, dd] = dayKey.split("-").map(Number)
  const label = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(yy, mm - 1, dd, 5)))
  return dayKey === yest ? `เมื่อวาน · ${label}` : label
}

const CHECK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
const SHARE = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
const SPARK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
const PEOPLE = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M20 20a6 6 0 0 0-4-5.6" /></svg>
const ROCKET = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 11a6 6 0 0 1 9-6 6 6 0 0 1-6 9l-3 3-3-3 3-3Z" /><circle cx="14.5" cy="9.5" r="1" /></svg>
const COIN = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5h3.2a1.5 1.5 0 0 1 0 3H10" /></svg>

/** ไอคอน+โทนของแถวประวัติจาก reason */
function iconFor(reason: string | null): { tone: Parameters<typeof IconTile>[0]["tone"]; icon: React.ReactNode } {
  const r = reason ?? ""
  if (r === "qi:earn:daily_login" || r.includes("checkin")) return { tone: "green", icon: CHECK }
  if (r === "qi:earn:share") return { tone: "green", icon: SHARE }
  if (r.startsWith("referral:") || r.startsWith("qi:earn:referral")) return { tone: "green", icon: PEOPLE }
  if (r.startsWith("qi:buy:")) return { tone: "orange", icon: COIN }
  if (r.startsWith("qi:spend:")) return { tone: "pink", icon: SPARK }
  if (r.startsWith("mission:")) return { tone: "blue", icon: ROCKET }
  return { tone: "ghost", icon: SPARK }
}

type Tab = "all" | "earn" | "spend"

export function QiHistoryScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [titles, setTitles] = useState<Map<string, string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [failed, setFailed] = useState(false)
  const [tab, setTab] = useState<Tab>("all")
  const [month, setMonth] = useState<string | null>(null)
  const [monthOpen, setMonthOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [w, m] = await Promise.all([
        fetch("/api/qi-wallet?history=100"),
        fetch("/api/missions").catch(() => null),
      ])
      if (w.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (!w.ok) {
        setFailed(true)
        return
      }
      setWallet((await w.json()) as Wallet)
      if (m?.ok) {
        const board = (await m.json()) as MissionBoard
        setTitles(new Map(board.missions.map((x) => [x.id, x.title])))
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const history = useMemo(() => wallet?.history ?? [], [wallet])
  const qiNow = wallet?.qi ?? 0

  // ยอดคงเหลือหลังแต่ละรายการ (คำนวณย้อนจากยอดปัจจุบัน; ประวัติเรียงใหม่→เก่า)
  const afterById = useMemo(() => {
    const map = new Map<WalletHistoryRow["id"], number>()
    let running = qiNow
    for (const h of history) {
      map.set(h.id, running)
      running -= h.qiDelta
    }
    return map
  }, [history, qiNow])

  const months = useMemo(() => {
    const set = new Set(history.map((h) => monthKey(h.createdAt)))
    return Array.from(set).sort().reverse()
  }, [history])

  const selMonth = month ?? months[0] ?? monthKey(new Date().toISOString())

  const monthRows = useMemo(() => history.filter((h) => monthKey(h.createdAt) === selMonth), [history, selMonth])
  const earnSum = monthRows.filter((h) => h.qiDelta > 0).reduce((s, h) => s + h.qiDelta, 0)
  const spendSum = monthRows.filter((h) => h.qiDelta < 0).reduce((s, h) => s + h.qiDelta, 0)

  const shown = monthRows.filter((h) => (tab === "all" ? true : tab === "earn" ? h.qiDelta > 0 : h.qiDelta < 0))

  // จัดกลุ่มตามวัน (คงลำดับใหม่→เก่า)
  const groups = useMemo(() => {
    const today = todayBangkok()
    const out: Array<{ day: string; header: string; rows: WalletHistoryRow[] }> = []
    for (const h of shown) {
      const day = bangkokDay(h.createdAt)
      const g = out.find((x) => x.day === day)
      if (g) g.rows.push(h)
      else out.push({ day, header: dayHeader(day, today), rows: [h] })
    }
    return out
  }, [shown])

  const olderExists = months.indexOf(selMonth) < months.length - 1

  const monthPicker = months.length > 0 && (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMonthOpen((o) => !o)}
        data-testid="qi-history-month"
        className="flex items-center gap-1 rounded-full border border-v3-border-card bg-white px-3 py-1.5 text-[12px] font-bold text-v3-navy"
      >
        {monthLabel(selMonth)}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {monthOpen && (
        <ul className="v3-shadow-card absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-[14px] bg-white py-1">
          {months.map((mk) => (
            <li key={mk}>
              <button
                type="button"
                onClick={() => { setMonth(mk); setMonthOpen(false) }}
                className={`block w-full px-4 py-2 text-left text-[13px] ${mk === selMonth ? "font-bold text-v3-navy" : "text-v3-text-body"}`}
              >
                {monthLabel(mk)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <SkyScreen>
      <QiHeader title="ประวัติ QI" testId="qi-history" right={!loading && !guard && !failed ? monthPicker : undefined} />

        {loading && (
          <div className="mt-3 flex flex-col gap-2" data-testid="qi-history-loading">
            <div className="h-[92px] w-full animate-pulse rounded-[20px] bg-v3-ghost-white" />
            <div className="h-[56px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[24px] bg-white p-5 text-center v3-shadow-card" data-testid="qi-history-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {!loading && !guard && failed && (
          <div className="mt-4 rounded-[24px] bg-white p-5 text-center v3-shadow-card" data-testid="qi-history-error">
            <p className="text-sm font-bold text-v3-navy">โหลดประวัติไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">
              ลองใหม่
            </button>
          </div>
        )}

        {!loading && !guard && !failed && wallet && (
          <div className="mt-3 flex flex-col gap-4">
            {/* สรุป 3 ค่าเดือนที่เลือก (การ์ด navy) */}
            <section className="grid grid-cols-3 rounded-[24px] bg-v3-sapphire px-3 py-4 text-center text-white" data-testid="qi-history-balance">
              <div className="border-r border-white/20 px-1">
                <p className="text-[11px] leading-4 text-white/80">ได้รับเดือนนี้</p>
                <p className="mt-1 text-[16px] font-black leading-6 text-v3-lime">+{earnSum.toLocaleString("th-TH")} QI</p>
              </div>
              <div className="border-r border-white/20 px-1">
                <p className="text-[11px] leading-4 text-white/80">ใช้ไปเดือนนี้</p>
                <p className="mt-1 text-[16px] font-black leading-6">{spendSum.toLocaleString("th-TH")} QI</p>
              </div>
              <div className="px-1">
                <p className="text-[11px] leading-4 text-white/80">คงเหลือ</p>
                <p className="mt-1 text-[16px] font-black leading-6 text-v3-lime" data-testid="qi-history-total">{qiNow.toLocaleString("th-TH")} QI</p>
              </div>
            </section>

            {/* แท็บกรอง */}
            <div className="flex rounded-full bg-[#FBF1F2] p-1 text-[13px] font-bold" data-testid="qi-history-tabs">
              {([["all", "ทั้งหมด"], ["earn", "ได้รับ"], ["spend", "ใช้ไป"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  data-testid={`qi-history-tab-${k}`}
                  className={`flex-1 rounded-full py-2 ${tab === k ? "bg-white text-v3-navy v3-shadow-line" : "text-v3-text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <section className="v3-shadow-card w-full rounded-[24px] bg-white p-5" data-testid="qi-history-empty">
                <p className="text-center text-[13px] leading-5 text-v3-text-body">
                  {history.length === 0
                    ? "ยังไม่มีรายการเคลื่อนไหว เริ่มสะสม QI ได้จากการเช็คอินรายวันและทำภารกิจ"
                    : "เดือนนี้ยังไม่มีรายการในหมวดนี้"}
                </p>
              </section>
            ) : (
              <div className="flex flex-col gap-4" data-testid="qi-history-list">
                {groups.map((g) => (
                  <section key={g.day}>
                    <p className="mb-2 px-1 text-[12px] font-bold text-v3-text-muted">{g.header}</p>
                    <ul className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white">
                      {g.rows.map((h) => {
                        const { tone, icon } = iconFor(h.reason)
                        const after = afterById.get(h.id)
                        return (
                          <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                            <IconTile tone={tone}>{icon}</IconTile>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-bold text-v3-navy">{reasonLabel(h.reason, titles ?? undefined)}</p>
                              <p className="text-[11px] leading-4 text-v3-text-muted">{bangkokTime(h.createdAt)}</p>
                            </div>
                            <div className="flex flex-none flex-col items-end gap-1">
                              <AmountPill qi={h.qiDelta} testId="qi-history-delta" />
                              {after !== undefined ? <span className="text-[10px] text-v3-text-muted">เหลือ {after.toLocaleString("th-TH")}</span> : null}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}

                {olderExists && (
                  <KitButton
                    variant="outline"
                    testId="qi-history-older"
                    onClick={() => setMonth(months[months.indexOf(selMonth) + 1] ?? selMonth)}
                  >
                    โหลดรายการเก่ากว่านี้
                  </KitButton>
                )}
              </div>
            )}

            <p className="px-2 text-center text-[11px] leading-4 text-v3-text-muted">
              เก็บประวัติย้อนหลัง 24 เดือน · ต้องการไฟล์ทั้งหมด ติดต่อ Line @mumate.co
            </p>
          </div>
        )}
    </SkyScreen>
  )
}

export default QiHistoryScreen

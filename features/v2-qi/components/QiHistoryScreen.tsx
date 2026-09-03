// features/v2-qi/components/QiHistoryScreen.tsx — จอ "ประวัติชี่" เต็ม (/v2/qi/history) — ก้อน 1.3.
//
// Design: Figma frame `qi-history — all` (หน้า "- profile"); ข้อมูลจาก GET /api/qi-wallet?history=100
// (engine เพดาน 100) + GET /api/missions เพื่อแปลง reason `mission:<id>` เป็นชื่อภารกิจจริง.
// ❌ การอ่านล้มต้องไม่ถูก render เป็น "ยังไม่มีรายการ" — สถานะ error แยกจาก empty (บทเรียน #365).
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { QiHeader } from "./QiHeader"
import { reasonLabel, type MissionBoard, type Wallet } from "../qi-model"

const CARD = "v3-shadow-card w-full rounded-[20px] bg-white p-5"

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

export function QiHistoryScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [titles, setTitles] = useState<Map<string, string> | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [failed, setFailed] = useState(false)

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

  const history = wallet?.history ?? []

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-white pb-10">
      <div className="mx-auto w-full max-w-md px-4">
        <QiHeader title="ประวัติชี่" testId="qi-history" />

        {loading && (
          <div className="mt-3 flex flex-col gap-2" data-testid="qi-history-loading">
            <div className="h-[56px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
            <div className="h-[56px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="qi-history-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {!loading && !guard && failed && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="qi-history-error">
            <p className="text-sm font-bold text-v3-navy">โหลดประวัติไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </div>
        )}

        {!loading && !guard && !failed && wallet && (
          <div className="mt-3 flex flex-col gap-4">
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="qi-history-balance">
              <p className="text-[12px] leading-4 text-white/80">ชี่สะสมปัจจุบัน</p>
              <p className="text-[30px] font-black leading-9" data-testid="qi-history-total">
                {wallet.qi ?? 0} ชี่
              </p>
            </section>

            {history.length === 0 ? (
              <section className={CARD} data-testid="qi-history-empty">
                <p className="text-center text-[13px] leading-5 text-v3-text-body">
                  ยังไม่มีรายการเคลื่อนไหว เริ่มสะสมชี่ได้จากการเช็คอินรายวันและทำภารกิจ
                </p>
              </section>
            ) : (
              <section className={CARD} data-testid="qi-history-list">
                <ul className="flex flex-col divide-y divide-v3-border-card">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-v3-navy">{reasonLabel(h.reason, titles ?? undefined)}</p>
                        <p className="text-[11px] leading-4 text-v3-text-muted">{dayLabel(h.createdAt)}</p>
                      </div>
                      <span
                        className={"flex-none text-[13px] font-black " + (h.qiDelta > 0 ? "text-v3-sapphire" : "text-v3-error")}
                        data-testid="qi-history-delta"
                      >
                        {h.qiDelta > 0 ? "+" : ""}
                        {h.qiDelta} ชี่
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default QiHistoryScreen

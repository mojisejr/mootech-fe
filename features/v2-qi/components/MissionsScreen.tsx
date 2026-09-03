// features/v2-qi/components/MissionsScreen.tsx — จอ "ภารกิจ" เต็ม (/v2/qi/missions) — ก้อน 1.2.
//
// Design: Figma frame `missions — all` (หน้า "- profile"); ตัวเลข/ชื่อภารกิจทั้งหมดมาจาก
// engine GET /api/missions (pdf-dev) เสมอ — จอเป็นแค่กระจก ไม่เก็บสถานะเอง.
// ความคืบหน้าเดินด้วยการใช้งานจริงในระบบ (เช็คอิน/บันทึกคำอธิษฐาน/ใช้แอปต่อเนื่อง) —
// ครบเป้า engine จ่ายรางวัลให้เองครั้งเดียว (claimedAt) จอไม่มีปุ่มกดรับให้สับสน.
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { QiHeader } from "./QiHeader"
import type { Mission, MissionBoard } from "../qi-model"

const CARD = "v3-shadow-card w-full rounded-[20px] bg-white p-5"

const PERIOD_LABEL: Record<Mission["period"], string> = {
  daily: "ทุกวัน",
  once: "จบครั้งเดียว",
}

function MissionRow({ m }: { m: Mission }) {
  const done = m.completed
  const pct = m.target > 0 ? Math.min(100, Math.round((m.count / m.target) * 100)) : 0
  return (
    <div className="rounded-[14px] border border-v3-border-card px-3 py-3" data-testid={`mission-${m.id}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-bold text-v3-navy">{m.title}</p>
            <span className="flex-none rounded-full bg-v3-ghost-white px-2 py-[2px] text-[10px] font-bold text-v3-text-muted">
              {PERIOD_LABEL[m.period]}
            </span>
          </div>
          <p className="mt-[2px] truncate text-[11px] leading-4 text-v3-text-muted">{m.description}</p>
        </div>
        <span className="flex-none rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-black text-v3-navy">
          +{m.rewardCoins} เหรียญ
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-v3-ghost-white">
          <div
            className="h-full rounded-full bg-v3-cyan transition-[width]"
            style={{ width: `${done ? 100 : pct}%` }}
            data-testid={`mission-progress-${m.id}`}
          />
        </div>
        {done ? (
          <span className="flex-none text-[11px] font-bold text-v3-sapphire" data-testid={`mission-state-${m.id}`}>
            {m.claimedAt ? "รับรางวัลแล้ว ✓" : "ครบแล้ว — กำลังมอบรางวัล"}
          </span>
        ) : (
          <span className="flex-none text-[11px] font-bold text-v3-text-muted" data-testid={`mission-state-${m.id}`}>
            {m.count}/{m.target}
          </span>
        )}
      </div>
    </div>
  )
}

export function MissionsScreen() {
  const [board, setBoard] = useState<MissionBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch("/api/missions")
      if (res.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (!res.ok) {
        setFailed(true)
        return
      }
      setBoard((await res.json()) as MissionBoard)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    // มือถือ 393 ตามเฟรม — บนจอคอมบีบคอลัมน์กลาง max-w-md (QiScreen pattern)
    <div className="font-ibm min-h-[100dvh] w-full bg-white pb-10">
      <div className="mx-auto w-full max-w-md px-4">
        <QiHeader title="ภารกิจ" testId="missions" />

        {loading && (
          <div className="mt-3 flex flex-col gap-2" data-testid="missions-loading">
            <div className="h-[86px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
            <div className="h-[86px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="missions-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {!loading && !guard && failed && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="missions-error">
            <p className="text-sm font-bold text-v3-navy">โหลดภารกิจไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </div>
        )}

        {!loading && !guard && !failed && board && (
          <div className="mt-3 flex flex-col gap-4">
            <p className="text-[12px] leading-4 text-v3-text-muted" data-testid="missions-date">
              รอบวันนี้ {board.date} — ภารกิจรายวันรีเซ็ตตอนเที่ยงคืน (เวลาไทย)
            </p>
            <section className={CARD} data-testid="missions-list">
              <div className="flex flex-col gap-2">
                {board.missions.map((m) => (
                  <MissionRow key={m.id} m={m} />
                ))}
              </div>
            </section>
            <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
              ความคืบหน้าเดินเองเมื่อคุณใช้งานจริงในระบบ ครบเป้าระบบมอบรางวัลให้อัตโนมัติทันที (ครั้งเดียวต่อรอบ)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MissionsScreen

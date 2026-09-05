// features/v2-qi/components/MissionsScreen.tsx — จอ "ภารกิจรับ QI" เต็ม (/v2/qi/missions) — ก้อน 1.2.
//
// Design: Figma frame `missions — all` (55399:6923): hero ความคืบหน้ารายวัน + แบนเนอร์คู่มือ +
// 3 กลุ่ม (ทำได้ทุกวัน/ครั้งเดียวจบ/ระยะยาว) พร้อมปุ่ม "ทำเลย" + เป้า referral + เป้าสะสม 5 ธาตุ.
// ข้อมูลทั้งหมดจาก engine GET /api/missions (missions + goals) + /api/qi-wallet (ยอด+เช็คอิน).
// ครบเป้า engine จ่ายรางวัลเป็น QI ให้เองครั้งเดียว (claimedAt).
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AmountPill, IconTile, SkyScreen } from "@/features/v2-profile/components/kit"
import { QiHeader } from "./QiHeader"
import { checkedInToday, todayBangkok, type Mission, type MissionBoard, type Wallet } from "../qi-model"

const CHECKIN_QI = 5 // = daily_login ใน catalog engine (แสดงผล; รางวัลจริงมาจากจอเช็คอิน)

const SUN = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>
const SHARE = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
const CRYSTAL = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 7 6-7 12L5 9l7-6Z M5 9h14M12 3v18" /></svg>
const CHAT = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></svg>
const BELL = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
const CHECK = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
const PEOPLE = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M20 20a6 6 0 0 0-4-5.6" /></svg>
const SPARK = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>

const ICON: Record<string, { tone: Parameters<typeof IconTile>[0]["tone"]; icon: React.ReactNode }> = {
  read_fortune: { tone: "orange", icon: SUN },
  share_fortune: { tone: "green", icon: SHARE },
  first_reading: { tone: "purple", icon: CRYSTAL },
  connect_line: { tone: "green", icon: CHAT },
  enable_notif: { tone: "blue", icon: BELL },
  streak_7: { tone: "green", icon: CHECK },
}
export const iconFor = (id: string) => ICON[id] ?? { tone: "ghost" as const, icon: SPARK }

// ไทล์มาสคอต 5 ธาตุ (เฟรม five-element-goal) — ใช้รูปจริงจาก public/images/v2/referral
const ELEMENT_TILE: Record<string, { mascot: string; bg: string }> = {
  wood: { mascot: "mascot-wood", bg: "#E6F4EC" },
  metal: { mascot: "mascot-metal", bg: "#E1E1E1" },
  fire: { mascot: "mascot-fire", bg: "#FBEAE8" },
  earth: { mascot: "mascot-earth", bg: "#F7EEE1" },
  water: { mascot: "mascot-water", bg: "#E4F1F7" },
}

const ELEMENT_META: Record<string, { label: string; color: string; bg: string }> = {
  wood: { label: "ธาตุไม้", color: "#3F8F52", bg: "#E8F5E9" },
  metal: { label: "ธาตุทอง", color: "#B08A2E", bg: "#FBF3DE" },
  fire: { label: "ธาตุไฟ", color: "#D75A3A", bg: "#FDEDE7" },
  earth: { label: "ธาตุดิน", color: "#9A7B4F", bg: "#F2ECE1" },
  water: { label: "ธาตุน้ำ", color: "#3A7BD5", bg: "#E7F0FD" },
}

/** เวลาถึงเที่ยงคืนไทย (ชม./นาที) สำหรับ "รีเซ็ตอีก ..." */
function untilBangkokMidnight(): { h: number; m: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date())
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0)
  const secs = ((24 - get("hour")) * 3600 - get("minute") * 60 - get("second")) % 86400
  return { h: Math.floor(secs / 3600), m: Math.floor((secs % 3600) / 60) }
}

function SectionHead({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <p className="text-[15px] font-black text-v3-navy">{title}</p>
      {right ? <p className="text-[11px] font-bold text-v3-text-muted">{right}</p> : null}
    </div>
  )
}

function ActionRow({
  testId, icon, title, desc, rewardQi, done, claimed, href, count, target, note,
}: {
  testId: string
  tone: Parameters<typeof IconTile>[0]["tone"]
  icon: React.ReactNode
  title: string
  desc: string
  rewardQi: number
  done: boolean
  claimed?: boolean
  href?: string
  count?: number
  target?: number
  note?: string
}) {
  const showProgress = typeof target === "number" && target > 1
  const pct = showProgress && typeof count === "number" ? Math.min(100, Math.round((count / (target as number)) * 100)) : 0
  return (
    <div className="flex flex-col gap-2 px-4 py-3.5" data-testid={testId}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 flex-none place-items-center rounded-[12px] bg-[#E3F8D1] text-[#3F8F52]">{done ? CHECK : icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-v3-navy">{title}</p>
          <p className="text-[11px] leading-4 text-v3-text-muted">{desc}</p>
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <AmountPill qi={rewardQi} sign="+" />
          {done ? (
            <span className="text-[11px] font-bold text-v3-text-muted" data-testid={`${testId}-state`}>{claimed ? "รับแล้ว ✓" : "เสร็จแล้ว"}</span>
          ) : href ? (
            <Link href={href} data-testid={`${testId}-cta`} className="rounded-full bg-v3-sapphire px-4 py-1 text-[11px] font-bold uppercase text-v3-lime">ทำเลย</Link>
          ) : showProgress ? null : (
            <span className="text-[11px] font-bold text-v3-text-muted" data-testid={`${testId}-state`}>{count}/{target}</span>
          )}
        </div>
      </div>
      {showProgress && (
        <div>
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-v3-ghost-white">
            <div className="h-full rounded-full bg-v3-sapphire" style={{ width: `${done ? 100 : pct}%` }} data-testid={`${testId}-progress`} />
          </div>
          <p className="mt-1 text-[10px] text-v3-text-muted">
            {count} / {target} วัน{!done && (target as number) > (count ?? 0) ? ` · อีก ${(target as number) - (count ?? 0)} วันถึงโบนัส` : ""}
          </p>
        </div>
      )}
      {note ? <p className="text-[10px] font-bold text-[#1B7F3B]">{note}</p> : null}
    </div>
  )
}

export function MissionsScreen() {
  const [board, setBoard] = useState<MissionBoard | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [res, w] = await Promise.all([fetch("/api/missions"), fetch("/api/qi-wallet").catch(() => null)])
      if (res.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (!res.ok) {
        setFailed(true)
        return
      }
      setBoard((await res.json()) as MissionBoard)
      if (w?.ok) setWallet((await w.json()) as Wallet)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const missions = board?.missions ?? []
  const daily = missions.filter((m) => m.category === "daily")
  const once = missions.filter((m) => m.category === "once")
  const longterm = missions.filter((m) => m.category === "longterm")
  const goals = board?.goals

  const didCheckin = checkedInToday(wallet?.history, todayBangkok())
  const dailyDone = (didCheckin ? 1 : 0) + daily.filter((m) => m.completed).length
  const dailyTotal = 1 + daily.length
  const remainingQi = (didCheckin ? 0 : CHECKIN_QI) + daily.filter((m) => !m.completed).reduce((s, m) => s + m.rewardCoins, 0)
  const onceDone = once.filter((m) => m.completed).length
  const { h, m } = untilBangkokMidnight()

  const balance = typeof wallet?.qi === "number" ? wallet.qi : null

  return (
    <SkyScreen>
      <QiHeader
        title="ภารกิจรับ QI"
        testId="missions"
        right={balance !== null ? <span className="text-[15px] font-black text-v3-navy" data-testid="missions-balance">{balance.toLocaleString("th-TH")} QI</span> : undefined}
      />

        {loading && (
          <div className="mt-3 flex flex-col gap-2" data-testid="missions-loading">
            <div className="h-[96px] w-full animate-pulse rounded-[24px] bg-v3-sapphire/20" />
            <div className="h-[72px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[24px] bg-white p-5 text-center v3-shadow-card" data-testid="missions-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">เข้าสู่ระบบ</Link>
          </div>
        )}

        {!loading && !guard && failed && (
          <div className="mt-4 rounded-[24px] bg-white p-5 text-center v3-shadow-card" data-testid="missions-error">
            <p className="text-sm font-bold text-v3-navy">โหลดภารกิจไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-navy text-sm font-bold text-white">ลองใหม่</button>
          </div>
        )}

        {!loading && !guard && !failed && board && (
          <div className="mt-3 flex flex-col gap-5">
            {/* hero ความคืบหน้ารายวัน */}
            <section className="rounded-[24px] bg-v3-sapphire p-5 text-white" data-testid="missions-hero">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-white/85">วันนี้ยังรับได้อีก</p>
                <p className="text-[22px] font-black text-v3-lime">+{remainingQi.toLocaleString("th-TH")} QI</p>
              </div>
              <div className="mt-3 h-[8px] w-full overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-v3-lime" style={{ width: `${dailyTotal ? Math.round((dailyDone / dailyTotal) * 100) : 0}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-white/85">ทำแล้ว {dailyDone} จาก {dailyTotal} ภารกิจรายวัน · รีเซ็ตอีก {h} ชม. {m} น.</p>
            </section>

            {/* แบนเนอร์คู่มือ QI */}
            <Link href="/v2/qi" className="flex items-center gap-3 rounded-[16px] bg-[#FDF4DC] px-4 py-3" data-testid="missions-guide-link">
              <IconTile tone="lime">{SPARK}</IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-v3-navy">QI คืออะไร ใช้ทำอะไรได้บ้าง</p>
                <p className="text-[11px] leading-4 text-v3-text-muted">อ่านคู่มือสะสมและใช้พลังชี่ฉบับเต็ม</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>

            {/* ทำได้ทุกวัน */}
            <div>
              <SectionHead title="ทำได้ทุกวัน" right="รีเซ็ตเที่ยงคืน" />
              <div className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white">
                <ActionRow testId="mission-daily_checkin" tone="green" icon={CHECK} title="เช็คอินรายวัน" desc="กดปุ่มเช็คอินในหน้าโปรไฟล์" rewardQi={CHECKIN_QI} done={didCheckin} href={didCheckin ? undefined : "/v2/qi/checkin"} />
                {daily.map((m) => (
                  <ActionRow
                    key={m.id}
                    testId={`mission-${m.id}`}
                    {...iconFor(m.id)}
                    title={m.title}
                    desc={m.description}
                    rewardQi={m.rewardCoins}
                    done={m.completed}
                    claimed={Boolean(m.claimedAt)}
                    href={m.completed ? undefined : m.actionHref}
                    count={m.count}
                    target={m.target}
                    note={m.id === "share_fortune" && !m.completed ? "+50 QI เพิ่ม เมื่อมีคนสมัครจากที่คุณแชร์" : undefined}
                  />
                ))}
              </div>
            </div>

            {/* ทำครั้งเดียวจบ */}
            {once.length > 0 && (
              <div>
                <SectionHead title="ทำครั้งเดียวจบ" right={`${onceDone} / ${once.length} เสร็จแล้ว`} />
                <div className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white">
                  {once.map((m) => (
                    <ActionRow key={m.id} testId={`mission-${m.id}`} {...iconFor(m.id)} title={m.title} desc={m.description} rewardQi={m.rewardCoins} done={m.completed} claimed={Boolean(m.claimedAt)} href={m.completed ? undefined : m.actionHref} count={m.count} target={m.target} />
                  ))}
                </div>
              </div>
            )}

            {/* เป้าหมายระยะยาว */}
            <div>
              <SectionHead title="เป้าหมายระยะยาว" right="รางวัลก้อนใหญ่" />
              <div className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white">
                {longterm.map((m) => (
                  <ActionRow key={m.id} testId={`mission-${m.id}`} {...iconFor(m.id)} title={m.title} desc={m.description} rewardQi={m.rewardCoins} done={m.completed} claimed={Boolean(m.claimedAt)} count={m.count} target={m.target} />
                ))}

                {/* เป้า referral */}
                {goals && (
                  <div className="flex flex-col gap-2 px-4 py-3.5" data-testid="mission-goal-referral">
                    <div className="flex items-center gap-3">
                      <IconTile tone="green">{PEOPLE}</IconTile>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-v3-navy">เพื่อนสมัครจากลิงก์ของคุณ</p>
                        <p className="text-[11px] leading-4 text-v3-text-muted">นับเมื่อเพื่อนกรอกวันเกิดและเช็คอินครั้งแรก</p>
                      </div>
                      <span className="flex-none rounded-full bg-[#E8F5E9] px-3 py-1 text-[11px] font-black text-[#1B7F3B]">+{goals.referral.rewardPerInviteQi} QI / คน</span>
                    </div>
                    <div className="h-[6px] w-full overflow-hidden rounded-full bg-v3-ghost-white">
                      <div className="h-full rounded-full bg-v3-sapphire" style={{ width: `${Math.min(100, goals.referral.invited * 20)}%` }} />
                    </div>
                    <p className="text-[10px] text-v3-text-muted">ชวนสำเร็จแล้ว {goals.referral.invited} คน · รับมาแล้ว {goals.referral.earnedQi.toLocaleString("th-TH")} QI</p>
                  </div>
                )}

                {/* เป้าสะสม 5 ธาตุ */}
                {goals && (
                  <div className="flex flex-col gap-3 px-4 py-3.5" data-testid="mission-goal-element">
                    <div className="flex items-center gap-3">
                      <IconTile tone="purple">{PEOPLE}</IconTile>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-v3-navy">สะสมเพื่อนครบ 5 ธาตุ</p>
                        <p className="text-[11px] leading-4 text-v3-text-muted">ธาตุของเพื่อนคำนวณจากวันเกิด · เลือกไม่ได้</p>
                      </div>
                      <span className="flex-none rounded-full bg-[#E8F5E9] px-3 py-1 text-[11px] font-black text-[#1B7F3B]">+{goals.element.bonusQi.toLocaleString("th-TH")} QI</span>
                    </div>
                    <div className="flex items-start justify-between gap-1">
                      {goals.element.elements.map((e) => {
                        const meta = ELEMENT_META[e.key] ?? { label: e.key, color: "#71717A", bg: "#ECF0FD" }
                        const tile = ELEMENT_TILE[e.key] ?? { mascot: "mascot-wood", bg: "#ECF0FD" }
                        return (
                          <div key={e.key} className="flex flex-1 flex-col items-center gap-1">
                            <span className="relative grid size-12 place-items-center overflow-hidden rounded-[14px]" style={{ backgroundColor: tile.bg, border: e.collected ? "1px solid #63B05F" : undefined, opacity: e.collected ? 1 : 0.5 }}>
                              <Image src={`/images/v2/referral/${tile.mascot}.png`} alt="" width={28} height={35} className="h-[35px] w-7 object-contain" />
                              {e.collected ? <img src="/images/v2/referral/success-mark.svg" alt="" aria-hidden className="absolute -right-1 -top-1 size-4" /> : null}
                            </span>
                            <span className="text-[9px] text-v3-text-muted">{meta.label}</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-v3-text-muted">
                      เก็บได้ {goals.element.collected} จาก {goals.element.target} ธาตุ
                      {goals.element.collected < goals.element.target
                        ? ` · ยังขาด${goals.element.elements.filter((e) => !e.collected).map((e) => ELEMENT_META[e.key]?.label ?? e.key).join(" และ ")}`
                        : " · ครบแล้ว รับโบนัสอัตโนมัติ"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
              ความคืบหน้าเดินเองเมื่อคุณใช้งานจริง ครบเป้าระบบมอบรางวัลเป็น QI ให้อัตโนมัติ (ครั้งเดียวต่อรอบ)
            </p>
          </div>
        )}
    </SkyScreen>
  )
}

export default MissionsScreen

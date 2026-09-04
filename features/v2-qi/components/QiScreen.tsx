// features/v2-qi/components/QiScreen.tsx — จอ "พลังชี่ของฉัน" (/v2/qi) — hub ของระบบชี่.
//
// Reskin 2026-09-04 ตามเฟรม `qi-guide - UX v2` (อ่านจริงจาก Figma หน้า "- profile"): พื้น BG01 +
// hero น้ำเงินเข้มมุมมนใหญ่ เหรียญใหญ่คู่ยอด + แถบ XP progress + ปุ่มเติมชี่ + แถวสะสมเป็นไอคอนไทล์.
// Identity = cookie-mumate-id (BFF ใช้เป็น anonId ของ engine). Engine (pdf-dev) = ที่มาเดียวของความจริง:
// ตัวเลขโบนัส/ราคาทุกตัวดึงจาก /api/qi-catalog ไม่ hardcode — แถวเรียงตาม catalog.
//
// จอย่อย: /v2/qi/buy (เติมชี่) · /v2/qi/checkin (เช็คอินเต็ม) · /v2/qi/missions · /v2/qi/history · /v2/qi/referral
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { SpendConfirmSheet, InsufficientQiSheet } from "./QiSpendSheets"
import { IconTile, SectionCard, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import {
  checkedInToday,
  reasonLabel,
  todayBangkok,
  type Entitlements,
  type QiCatalog,
  type QiSpendLine,
  type Referral,
  type Wallet,
} from "../qi-model"

const EARN_TILE: Record<string, { icon: string; tone: "ghost" | "blue" | "pink" | "green" | "orange" | "purple" | "teal" | "lime" }> = {
  signup: { icon: "🎁", tone: "lime" },
  daily_login: { icon: "📅", tone: "blue" },
  share: { icon: "📣", tone: "teal" },
  referral_free: { icon: "🤝", tone: "green" },
  referral_plus: { icon: "⭐", tone: "orange" },
  referral_pro: { icon: "👑", tone: "purple" },
  wuxing_matrix: { icon: "🀄", tone: "pink" },
}

const TIER_LABEL: Record<string, string> = { free: "ฟรี", plus: "PLUS", pro: "PRO" }

type SheetState = { kind: "confirm" | "insufficient"; line: QiSpendLine } | null

export function QiScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [catalog, setCatalog] = useState<QiCatalog | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [claimed, setClaimed] = useState<Record<string, "ok" | "capped" | "error">>({})
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState<SheetState>(null)
  // team.mp4 2026-09 — @name โชว์จางๆ (เหมือน LINE); ยังไม่เคยตั้ง = null
  const [displayName, setDisplayName] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [w, r, c, e, dn] = await Promise.all([
        fetch("/api/qi-wallet"),
        fetch("/api/referral"),
        fetch("/api/qi-catalog"),
        fetch("/api/qi-entitlements"),
        fetch("/api/v2/display-name"),
      ])
      if (w.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (w.ok) setWallet(await w.json())
      if (r.ok) setReferral(await r.json())
      if (c.ok) setCatalog(await c.json())
      if (e.ok) setEntitlements(await e.json())
      if (dn.ok) {
        const j = (await dn.json().catch(() => ({}))) as { displayName?: string | null }
        setDisplayName(typeof j.displayName === "string" && j.displayName ? j.displayName : null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const earn = async (code: string) => {
    setBusyCode(code)
    try {
      const res = await fetch("/api/qi-earn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        setClaimed((m) => ({ ...m, [code]: j.capped ? "capped" : "ok" }))
        await load()
      } else if (res.status === 409 || String(j.error ?? "").includes("capped")) {
        setClaimed((m) => ({ ...m, [code]: "capped" }))
      } else {
        setClaimed((m) => ({ ...m, [code]: "error" }))
      }
    } finally {
      setBusyCode(null)
    }
  }

  const checkedIn = checkedInToday(wallet?.history, todayBangkok())
  const balance = wallet?.qi ?? 0
  // XP progress ระดับปัจจุบัน (engine ส่ง nextLevelXp/levelStartXp มาใน wallet)
  const xpStart = typeof wallet?.levelStartXp === "number" ? wallet.levelStartXp : 0
  const xpNext = typeof wallet?.nextLevelXp === "number" ? wallet.nextLevelXp : 1000
  const xpNow = typeof wallet?.xp === "number" ? wallet.xp : 0
  const xpPct = Math.max(0, Math.min(100, Math.round(((xpNow - xpStart) / Math.max(1, xpNext - xpStart)) * 100)))
  const openSpend = (line: QiSpendLine) =>
    setSheet(balance >= line.qi ? { kind: "confirm", line } : { kind: "insufficient", line })

  return (
    <SkyScreen>
      <Head>
        <title>พลังชี่ของฉัน — Mumate</title>
      </Head>
      <SkyHeader title="พลังชี่ของฉัน" testId="qi" />

      {loading && (
        <div className="mt-3" data-testid="qi-loading">
          <div className="h-[190px] w-full animate-pulse rounded-[28px] bg-v3-sapphire/20" />
          <div className="mt-3 h-[220px] w-full animate-pulse rounded-[24px] bg-white" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="qi-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}

      {!loading && !guard && (
        <div className="mt-3 flex flex-col gap-4">
          {/* hero น้ำเงินเข้มมุมมนใหญ่ + เหรียญใหญ่ (เฟรม qi-guide - UX v2) */}
          <section className="relative overflow-hidden rounded-[28px] bg-v3-sapphire p-6 text-white" data-testid="qi-wallet">
            <span aria-hidden className="v3-float-wide absolute -right-3 -top-3 block size-[110px] opacity-90">
              <Image src="/images/v2/zone2/coin.png" alt="" width={110} height={110} unoptimized className="size-full object-contain" />
            </span>
            <p className="text-[12px] leading-4 text-white/75">ชี่สะสมของคุณ</p>
            <p className="mt-1 text-[44px] font-black leading-[52px]" data-testid="qi-balance">
              {balance.toLocaleString("th-TH")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/85">
              <span>เหรียญ {wallet?.coins ?? 0}</span>
              <span>·</span>
              <span>Level {wallet?.level ?? 1}</span>
              {entitlements?.tier && entitlements.tier !== "free" ? (
                <>
                  <span>·</span>
                  <span data-testid="qi-tier">{TIER_LABEL[entitlements.tier] ?? entitlements.tier}</span>
                </>
              ) : null}
            </div>
            {displayName ? (
              <p data-testid="qi-display-name" className="text-[12px] leading-4 text-white/55">@{displayName}</p>
            ) : null}

            {/* แถบ XP progress ระดับปัจจุบัน (เฟรมโชว์ระดับ/ความคืบหน้า) */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-white/75">
                <span>XP {xpNow}</span>
                <span>ถึง Level ถัดไป {xpNext}</span>
              </div>
              <div className="mt-1 h-[8px] w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-v3-lime" style={{ width: `${xpPct}%` }} data-testid="qi-xp-bar" />
              </div>
            </div>

            <Link
              href="/v2/qi/buy"
              data-testid="qi-topup-link"
              className="mt-4 grid h-11 w-full place-items-center rounded-full bg-v3-lime text-[14px] font-black text-v3-navy"
            >
              เติมชี่
            </Link>
          </section>

          {/* เช็คอินรายวัน (สถานะอ่านจากประวัติวันนี้ — engine cap ให้อยู่แล้ว) + จอเต็ม /v2/qi/checkin */}
          <SectionCard className="!p-3">
            <div className="flex items-center gap-3" data-testid="qi-checkin">
              <span aria-hidden className="grid size-11 flex-none place-items-center rounded-[14px] bg-[#E3F2FD] text-[20px]">📅</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-v3-navy">
                  เช็คอินรายวัน{" "}
                  <Link href="/v2/qi/checkin" data-testid="qi-checkin-link" className="text-[12px] font-bold text-v3-cyan">
                    ดูสถานะ →
                  </Link>
                </p>
                <p className="text-[11px] leading-4 text-v3-text-muted">กลับมาทุกวัน รับ +5 ชี่</p>
              </div>
              <button
                onClick={() => void earn("daily_login")}
                disabled={checkedIn || busyCode === "daily_login"}
                data-testid="qi-checkin-btn"
                className={
                  (checkedIn ? "bg-v3-disabled-bg text-v3-text-muted" : "bg-v3-cyan text-white") +
                  " grid h-10 flex-none place-items-center rounded-full px-4 text-[12px] font-bold transition disabled:cursor-default"
                }
              >
                {checkedIn ? "เช็คอินแล้ว ✓" : busyCode === "daily_login" ? "..." : "เช็คอิน"}
              </button>
            </div>
          </SectionCard>

          {/* วิธีสะสมพลังชี่ — แถวจาก catalog ของ engine; เส้นชวนเพื่อน (per_referral) เดินเองตามการชวน */}
          <SectionCard testId="qi-tasks">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-v3-navy">วิธีสะสมพลังชี่</h2>
              <Link href="/v2/qi/missions" data-testid="qi-missions-link" className="text-[12px] font-bold text-v3-cyan">
                ภารกิจทั้งหมด →
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {(catalog?.earn ?? []).map((line) => {
                const isPerReferral = line.limit === "per_referral"
                const state = claimed[line.code]
                const tile = EARN_TILE[line.code] ?? { icon: "✨", tone: "ghost" as const }
                return (
                  <div key={line.code} className="flex items-center gap-3 rounded-[16px] border border-v3-border-card px-3 py-3">
                    <IconTile tone={tile.tone} className="!size-10 !rounded-[12px] !text-[18px]">{tile.icon}</IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-v3-navy">{line.title}</p>
                      <p className="truncate text-[11px] leading-4 text-v3-text-muted">{line.note}</p>
                    </div>
                    <span className="flex-none rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-black text-v3-navy">+{line.qi}</span>
                    {isPerReferral ? (
                      <Link href="/v2/qi/referral" data-testid={`qi-task-${line.code}`} className="flex-none text-[12px] font-bold text-v3-cyan underline">
                        ไปชวน
                      </Link>
                    ) : (
                      <button
                        onClick={() => void earn(line.code)}
                        disabled={busyCode === line.code || state === "capped"}
                        data-testid={`qi-task-${line.code}`}
                        className={
                          (state === "capped" ? "bg-v3-disabled-bg text-v3-text-muted" : "bg-v3-cyan text-white") +
                          " grid h-9 flex-none place-items-center rounded-full px-3 text-[12px] font-bold transition disabled:cursor-default"
                        }
                      >
                        {state === "capped" ? "รับแล้ว" : busyCode === line.code ? "..." : "รับ"}
                      </button>
                    )}
                  </div>
                )
              })}
              {!catalog && (
                <div className="h-[64px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />
              )}
            </div>
          </SectionCard>

          {/* แลกสิทธิ์ด้วยชี่ — ราคาจาก catalog */}
          <SectionCard testId="qi-redeem">
            <h2 className="text-base font-bold text-v3-navy">แลกสิทธิ์ด้วยชี่</h2>
            <div className="mt-3 flex flex-col gap-2">
              {(catalog?.spend ?? []).map((line) => (
                <div key={line.code} className="flex items-center gap-3 rounded-[16px] border border-v3-border-card px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-v3-navy">{line.title}</p>
                    <p className="truncate text-[11px] leading-4 text-v3-text-muted">{line.note}</p>
                  </div>
                  <button
                    onClick={() => openSpend(line)}
                    data-testid={`qi-redeem-${line.code}`}
                    className="grid h-9 flex-none place-items-center rounded-full bg-v3-sapphire px-3 text-[12px] font-bold text-white"
                  >
                    {line.qi} ชี่
                  </button>
                </div>
              ))}
              {!catalog && (
                <div className="h-[64px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />
              )}
            </div>
            {entitlements?.credits && (
              <p className="mt-2 text-[11px] leading-4 text-v3-text-muted" data-testid="qi-credits">
                สิทธิ์คงเหลือ: เปิดการ์ด {entitlements.credits.card_use ?? 0} · ถาม AI {entitlements.credits.chat_question ?? 0} ·
                ช่องจับคู่ {entitlements.credits.matching_slot ?? 0}
              </p>
            )}
          </SectionCard>

          {/* referral — แถวย่อ + ทางเข้า hub เต็ม */}
          <SectionCard id="referral" testId="qi-referral">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-v3-navy">ชวนเพื่อน รับเหรียญคนละกอง</h2>
              <Link href="/v2/qi/referral" data-testid="qi-referral-link" className="text-[12px] font-bold text-v3-cyan">
                หน้าชวนเพื่อน →
              </Link>
            </div>
            <p className="mt-1 text-[12px] leading-4 text-v3-text-body">
              เพื่อนสมัครผ่านโค้ดของคุณ — เพื่อนได้ +100 เหรียญ คุณได้ +250 เหรียญ
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-v3-border-input bg-white px-4">
                <span className="truncate text-[14px] font-black tracking-wider text-v3-navy" data-testid="qi-referral-code">
                  {referral?.code ?? "······"}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!referral?.code) return
                  await navigator.clipboard.writeText(referral.code).catch(() => {})
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                }}
                data-testid="qi-referral-copy"
                className="grid h-11 flex-none place-items-center rounded-full bg-v3-sapphire px-4 text-[12px] font-bold text-white"
              >
                {copied ? "คัดลอกแล้ว!" : "คัดลอกโค้ด"}
              </button>
            </div>
            {typeof referral?.invitedCount === "number" && (
              <p className="mt-2 text-[11px] text-v3-text-muted">เพื่อนที่ใช้โค้ดแล้ว: {referral.invitedCount} คน</p>
            )}
          </SectionCard>

          {/* เคลื่อนไหวล่าสุด (ย่อ 3 แถว) + ทางเข้าประวัติเต็ม */}
          {wallet?.history && wallet.history.length > 0 && (
            <SectionCard testId="qi-history">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-v3-navy">เคลื่อนไหวล่าสุด</h2>
                <Link href="/v2/qi/history" data-testid="qi-history-link" className="text-[12px] font-bold text-v3-cyan">
                  ดูทั้งหมด →
                </Link>
              </div>
              <ul className="mt-2 flex flex-col divide-y divide-v3-border-card">
                {wallet.history.slice(0, 3).map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-v3-text-body">{reasonLabel(h.reason)}</span>
                    <span className={"flex-none font-bold " + (h.qiDelta > 0 ? "text-v3-sapphire" : "text-v3-error")}>
                      {h.qiDelta > 0 ? "+" : ""}
                      {h.qiDelta} ชี่
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}

      {/* ชีตใช้ชี่/ชี่ไม่พอ — ครอบทั้งจอ; กดสำเร็จแล้วอัปเดตยอดจากค่าที่ engine ตอบ */}
      {sheet?.kind === "confirm" && (
        <SpendConfirmSheet
          line={sheet.line}
          balance={balance}
          onClose={() => setSheet(null)}
          onSpent={(qiLeft) => {
            setWallet((w) => (w ? { ...w, qi: qiLeft } : w))
            setSheet(null)
            void load()
          }}
          onInsufficient={() => {
            setSheet({ kind: "insufficient", line: sheet.line })
            // ยอดบนจออาจ stale (409 แปลว่า engine เห็นยอดไม่พอ) — ดึงยอดใหม่เพื่อโชว์ยอดขาที่ถูก
            void load()
          }}
        />
      )}
      {sheet?.kind === "insufficient" && (
        <InsufficientQiSheet line={sheet.line} balance={balance} onClose={() => setSheet(null)} />
      )}
    </SkyScreen>
  )
}

export default QiScreen

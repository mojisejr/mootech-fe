// features/v2-qi/components/QiScreen.tsx — จอ "พลังชี่ของฉัน" (/v2/qi) — hub ของระบบชี่ (ก้อน 1).
//
// Design: Figma "Mumate app_final" หน้า "- profile" — frames `qi-guide - UX v2` · `check-in — reward
// moments` · `insufficient-qi-sheet` · `spend-confirm-sheet`. Identity = cookie-mumate-id (BFF ใช้เป็น
// anonId ของ engine ให้). Engine (pdf-dev) = ที่มาเดียวของความจริง: ตัวเลขโบนัส/ราคาทุกตัวจอแสดง
// ดึงจาก /api/qi-catalog ไม่ hardcode — แถวภารกิจ/แถวแลกสิทธิ์เรียงตาม catalog.
//
// จอย่อยในกลุ่ม: /v2/qi/missions (ภารกิจ 1.2) · /v2/qi/history (ประวัติ 1.3) · /v2/qi/referral (ชวนเพื่อน 5.1)
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { SpendConfirmSheet, InsufficientQiSheet } from "./QiSpendSheets"
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

const CARD = "v3-shadow-card w-full rounded-[20px] bg-white p-5"

const EARN_ICON: Record<string, string> = {
  signup: "🎁",
  daily_login: "📅",
  share: "📣",
  referral_free: "🤝",
  referral_plus: "⭐",
  referral_pro: "👑",
  wuxing_matrix: "🀄",
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
  // team.mp4 2026-09 — @name โชว์จางๆ ใต้ Level/XP (เหมือน LINE); ยังไม่เคยตั้ง = null (ตั้งได้ที่หน้าสมัคร)
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

  const copyCode = async () => {
    if (!referral?.code) return
    await navigator.clipboard.writeText(referral.code).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const checkedIn = checkedInToday(wallet?.history, todayBangkok())
  const balance = wallet?.qi ?? 0
  // เส้นที่ผู้ใช้กดรับเองได้ = daily/once; เส้น per_referral เดินเองตามการชวน — เปิดชีตเมื่อชี่พอ, ไม่พอก็ชีตเดียวกัน
  const openSpend = (line: QiSpendLine) =>
    setSheet(balance >= line.qi ? { kind: "confirm", line } : { kind: "insufficient", line })

  return (
    // เฟรม Figma เป็นมือถือ 393 — บนจอคอมบีบคอลัมน์กลาง max-w-md เหมือนหน้าอื่น (AccountScreen pattern)
    <div className="font-ibm min-h-[100dvh] w-full bg-white pb-10">
      <div className="mx-auto w-full max-w-md px-4">
        <Head>
          <title>พลังชี่ของฉัน — Mumate</title>
        </Head>

        <header className="flex w-full items-center gap-2 pt-4">
          <Link
            href="/v2"
            aria-label="ย้อนกลับ"
            data-testid="qi-back"
            className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-lg font-black leading-6 text-v3-navy">พลังชี่ของฉัน</h1>
        </header>

        {loading && (
          <div className="pt-4" data-testid="qi-loading">
            <div className="h-[150px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
            <div className="mt-3 h-[220px] w-full animate-pulse rounded-[20px] bg-white" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="qi-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {!loading && !guard && (
          <div className="mx-4 mt-3 flex flex-col gap-4">
            {/* wallet hero */}
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="qi-wallet">
              <div className="flex items-start justify-between">
                <p className="text-[12px] leading-4 text-white/80">ชี่สะสม</p>
                {/* #? 🪙 (U+1FA99) ไม่มีในฟอนต์ Windows 10 → กล่องโหว่; ใช้รูปเหรียญแทน */}
                <span aria-hidden className="v3-float-wide block size-[26px]">
                  <Image src="/images/v2/zone2/coin.png" alt="" width={26} height={26} unoptimized className="size-full object-contain" />
                </span>
              </div>
              <p className="flex items-center gap-2 text-[34px] font-black leading-10" data-testid="qi-balance">
                <Image src="/images/v2/zone2/coin.png" alt="" width={30} height={30} unoptimized className="size-[30px] object-contain" />
                {balance}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[12px] text-white/85">
                <span>เหรียญ {wallet?.coins ?? 0}</span>
                <span>·</span>
                <span>Level {wallet?.level ?? 1}</span>
                <span>·</span>
                <span>XP {wallet?.xp ?? 0}</span>
                {entitlements?.tier && entitlements.tier !== "free" ? (
                  <>
                    <span>·</span>
                    <span data-testid="qi-tier">{TIER_LABEL[entitlements.tier] ?? entitlements.tier}</span>
                  </>
                ) : null}
              </div>
              {/* buy-qi (ก้อน 1.6) — ทางเข้าเติมชี่จาก hero เสมอ */}
              <Link
                href="/v2/qi/buy"
                data-testid="qi-topup-link"
                className="mt-3 grid h-10 w-full place-items-center rounded-full bg-white/15 text-[13px] font-bold text-white"
              >
                เติมชี่
              </Link>
              {/* team.mp4 2026-09 — @name โชว์จางๆ ใต้ชื่อ/สถานะเหมือน LINE (ยังไม่ตั้ง = ไม่แสดง) */}
              {displayName ? (
                <p data-testid="qi-display-name" className="mt-1 text-[12px] leading-4 text-white/60">
                  @{displayName}
                </p>
              ) : null}
            </section>

            {/* เช็คอินรายวัน (frame `check-in — reward moments`; สถานะอ่านจากประวัติวันนี้ — engine cap ให้อยู่แล้ว)
                จอเต็ม /v2/qi/checkin (เฟรม check-in — states): strip 7 วัน + สตรีค */}
            <section className={CARD} data-testid="qi-checkin">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-v3-ghost-white text-[18px]" aria-hidden>
                  📅
                </span>
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
            </section>

            {/* Qi Token คืออะไร */}
            <section className={CARD}>
              <h2 className="text-base font-bold text-v3-navy">Qi Token คืออะไร?</h2>
              <p className="mt-1 text-[13px] leading-[20px] text-v3-text-body">
                ชี่คือพลังงานที่สะสมได้ ใช้เปิดการ์ด เสี่ยงทาย และอ่านดวงเจาะลึกเป็นรายบท
                ยิ่งสะสม ยิ่งอ่านได้มาก — เริ่มสะสมวันนี้เลย
              </p>
            </section>

            {/* วิธีสะสมพลังชี่ — แถวจาก catalog ของ engine; เส้นชวนเพื่อน (per_referral) เดินเองตามการชวน */}
            <section className={CARD} data-testid="qi-tasks">
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
                  return (
                    <div key={line.code} className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-3 py-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-v3-ghost-white text-[16px]" aria-hidden>
                        {EARN_ICON[line.code] ?? "✨"}
                      </span>
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
                  <div className="h-[64px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
                )}
              </div>
            </section>

            {/* แลกสิทธิ์ด้วยชี่ (frame `spend-confirm-sheet` + `insufficient-qi-sheet`) — ราคาจาก catalog */}
            <section className={CARD} data-testid="qi-redeem">
              <h2 className="text-base font-bold text-v3-navy">แลกสิทธิ์ด้วยชี่</h2>
              <div className="mt-3 flex flex-col gap-2">
                {(catalog?.spend ?? []).map((line) => (
                  <div key={line.code} className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-3 py-3">
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
                  <div className="h-[64px] w-full animate-pulse rounded-[14px] bg-v3-ghost-white" />
                )}
              </div>
              {/* เครดิตคงเหลือที่เคยแลกไว้ (จาก /api/qi-entitlements) */}
              {entitlements?.credits && (
                <p className="mt-2 text-[11px] leading-4 text-v3-text-muted" data-testid="qi-credits">
                  สิทธิ์คงเหลือ: เปิดการ์ด {entitlements.credits.card_use ?? 0} · ถาม AI {entitlements.credits.chat_question ?? 0} ·
                  ช่องจับคู่ {entitlements.credits.matching_slot ?? 0}
                </p>
              )}
            </section>

            {/* referral — แถวย่อ + ทางเข้า hub เต็ม (frame `referral - hub` อยู่ที่ /v2/qi/referral) */}
            <section id="referral" className={CARD} data-testid="qi-referral">
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
                  onClick={copyCode}
                  data-testid="qi-referral-copy"
                  className="grid h-11 flex-none place-items-center rounded-full bg-v3-sapphire px-4 text-[12px] font-bold text-white"
                >
                  {copied ? "คัดลอกแล้ว!" : "คัดลอกโค้ด"}
                </button>
              </div>
              {typeof referral?.invitedCount === "number" && (
                <p className="mt-2 text-[11px] text-v3-text-muted">เพื่อนที่ใช้โค้ดแล้ว: {referral.invitedCount} คน</p>
              )}
            </section>

            {/* เคลื่อนไหวล่าสุด (ย่อ 3 แถว) + ทางเข้าประวัติเต็ม (frame `qi-history — all`) */}
            {wallet?.history && wallet.history.length > 0 && (
              <section className={CARD} data-testid="qi-history">
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
              </section>
            )}
          </div>
        )}
      </div>

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
    </div>
  )
}

export default QiScreen

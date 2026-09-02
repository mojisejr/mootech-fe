// features/v2-qi/components/QiScreen.tsx — จอ "พลังชี่ของฉัน" (/v2/qi).
//
// Design: Figma "Mumate app_ final" frame `qi-token-guide-v2-brand-ci` (page "- Mumate AI")
// + จอ wallet จากคลิปทีม (ยอดชี่ / วิธีสะสม / ประวัติ). Identity = cookie-mumate-id
// (BFF ใช้เป็น anonId ของ engine ให้ — ค่าเดิมคนเดิม ตลอดชีพ). Engine routes ตรวจแล้วกับ
// deploy pdf-dev 2026-09-02: /api/qi/wallet · /api/qi/earn · /api/referral.
//
// 🔴 ตัวเลขโบนัสตาม catalog ของ engine (ไม่ใช่ตัวเลขจากจอ): daily_login +5 · share +10 ·
//    referral_free +50 (ผู้ชวนได้ 250 coins ตาม /api/referral) · ชวนอัปเกรด +500/+1000.
// TODO(figma-copy): สแกน qi-token-guide ที่เหลือ (แถวหลัง fold) แล้วเติมแถวภารกิจให้ตรงเฟรม
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type Wallet = {
  qi?: number
  coins?: number
  xp?: number
  level?: number | string
  history?: Array<{ id: number | string; qiDelta: number; reason: string | null; createdAt: string }>
}
type Referral = { code?: string; redeemed?: number }

const TASKS: Array<{ code: string; icon: string; title: string; sub: string; qi: number }> = [
  { code: "daily_login", icon: "📅", title: "เข้าใช้งานรายวัน", sub: "กลับมาทุกวันรับชี่ฟรี", qi: 5 },
  { code: "share", icon: "📣", title: "แชร์คอนเทนต์", sub: "แชร์ดวงวันนี้ให้เพื่อน", qi: 10 },
  { code: "referral_free", icon: "🤝", title: "ชวนเพื่อนสมัครฟรี", sub: "เพื่อนสมัครผ่านโค้ดของคุณ", qi: 50 },
  { code: "referral_plus", icon: "⭐", title: "ชวนเพื่อนอัปเกรด PLUS", sub: "เพื่อนซื้อแพ็ก PLUS", qi: 500 },
  { code: "referral_pro", icon: "👑", title: "ชวนเพื่อนอัปเกรด PRO", sub: "เพื่อนซื้อแพ็ก PRO", qi: 1000 },
]

const CARD = "w-full rounded-[20px] bg-white p-5 shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

export function QiScreen() {
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [claimed, setClaimed] = useState<Record<string, "ok" | "capped" | "error">>({})
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [refInput, setRefInput] = useState("")
  const [refMsg, setRefMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([
        fetch("/api/qi-wallet"),
        fetch("/api/referral"),
      ])
      if (w.status === 401 || r.status === 401) return setGuard("not_authenticated")
      if (w.ok) setWallet(await w.json())
      if (r.ok) setReferral(await r.json())
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

  const applyReferral = async () => {
    const code = refInput.trim()
    if (!code) return
    setRefMsg(null)
    const res = await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const j = await res.json().catch(() => ({}))
    setRefMsg(res.ok ? "รับโบนัสสำเร็จ! ได้เหรียญคนละกองเลย" : String(j.error ?? "โค้ดไม่ถูกต้อง หรือใช้ไปแล้ว"))
    if (res.ok) {
      setRefInput("")
      await load()
    }
  }

  const copyCode = async () => {
    if (!referral?.code) return
    await navigator.clipboard.writeText(referral.code).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-bg-cream pb-10">
      <Head>
        <title>พลังชี่ของฉัน — Mumate</title>
      </Head>

      <header className="flex w-full items-center gap-2 px-4 pt-4">
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
        <div className="px-4 pt-4" data-testid="qi-loading">
          <div className="h-[150px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
          <div className="mt-3 h-[220px] w-full animate-pulse rounded-[20px] bg-white" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="mx-4 mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="qi-guard-auth">
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
            <p className="text-[12px] leading-4 text-white/80">ชี่สะสม</p>
            <p className="text-[34px] font-black leading-10" data-testid="qi-balance">
              🪙 {wallet?.qi ?? 0}
            </p>
            <div className="mt-2 flex items-center gap-3 text-[12px] text-white/85">
              <span>เหรียญ {wallet?.coins ?? 0}</span>
              <span>·</span>
              <span>Level {wallet?.level ?? 1}</span>
              <span>·</span>
              <span>XP {wallet?.xp ?? 0}</span>
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

          {/* วิธีสะสมพลังชี่ */}
          <section className={CARD} data-testid="qi-tasks">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-v3-navy">วิธีสะสมพลังชี่</h2>
              <span className="text-[11px] text-v3-text-muted">กดรับได้ทันที</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {TASKS.map((t) => {
                const state = claimed[t.code]
                return (
                  <div key={t.code} className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-3 py-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-v3-ghost-white text-[16px]" aria-hidden>
                      {t.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-v3-navy">{t.title}</p>
                      <p className="truncate text-[11px] leading-4 text-v3-text-muted">{t.sub}</p>
                    </div>
                    <span className="flex-none rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-black text-v3-navy">+{t.qi}</span>
                    {t.code === "referral_free" ? (
                      <a href="#referral" data-testid={`qi-task-${t.code}`} className="flex-none text-[12px] font-bold text-v3-cyan underline">
                        ไปชวน
                      </a>
                    ) : (
                      <button
                        onClick={() => earn(t.code)}
                        disabled={busyCode === t.code || state === "capped"}
                        data-testid={`qi-task-${t.code}`}
                        className={
                          (state === "capped" ? "bg-v3-disabled-bg text-v3-text-muted" : "bg-v3-cyan text-white") +
                          " grid h-9 flex-none place-items-center rounded-full px-3 text-[12px] font-bold transition disabled:cursor-default"
                        }
                      >
                        {state === "capped" ? "รับแล้ว" : busyCode === t.code ? "..." : "รับ"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* referral */}
          <section id="referral" className={CARD} data-testid="qi-referral">
            <h2 className="text-base font-bold text-v3-navy">ชวนเพื่อน รับเหรียญคนละกอง</h2>
            <p className="mt-1 text-[12px] leading-4 text-v3-text-body">
              เพื่อนกรอกโค้ดของคุณตอนสมัคร — เพื่อนได้ +100 เหรียญ คุณได้ +250 เหรียญ
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
            {typeof referral?.redeemed === "number" && (
              <p className="mt-2 text-[11px] text-v3-text-muted">เพื่อนที่ใช้โค้ดแล้ว: {referral.redeemed} คน</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <input
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="มีโค้ดเพื่อน? กรอกที่นี่"
                data-testid="qi-referral-input"
                className="h-11 min-w-0 flex-1 rounded-full border border-v3-border-input bg-white px-4 text-[13px] text-v3-text-filled outline-none placeholder:text-v3-placeholder"
              />
              <button
                onClick={applyReferral}
                disabled={!refInput.trim()}
                data-testid="qi-referral-apply"
                className="grid h-11 flex-none place-items-center rounded-full bg-v3-cyan px-4 text-[12px] font-bold text-white disabled:opacity-40"
              >
                ใช้โค้ด
              </button>
            </div>
            {refMsg && (
              <p data-testid="qi-referral-msg" className="mt-2 text-[12px] font-medium text-v3-sapphire">
                {refMsg}
              </p>
            )}
          </section>

          {/* ประวัติ */}
          {wallet?.history && wallet.history.length > 0 && (
            <section className={CARD} data-testid="qi-history">
              <h2 className="text-base font-bold text-v3-navy">เคลื่อนไหวล่าสุด</h2>
              <ul className="mt-2 flex flex-col divide-y divide-v3-border-card">
                {wallet.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-v3-text-body">{h.reason ?? "ภารกิจ"}</span>
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
  )
}

export default QiScreen

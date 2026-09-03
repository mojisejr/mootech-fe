// features/v2-qi/components/ReferralHubScreen.tsx — จอ "ชวนเพื่อน" เต็ม (/v2/qi/referral) — ก้อน 5.1.
//
// Design: Figma frames `referral - hub` · `share-code to friend` (หน้า "- profile").
// ข้อมูล: GET /api/referral (โค้ด/จำนวนเพื่อน) + GET /api/qi-catalog (แถวโบนัสชวนเพื่อน — ตัวเลขจาก engine).
// Deep link /invite/<code> มีอยู่แล้ว (pages/invite/[code].tsx) — ลิงก์แชร์ชี้เข้าเส้นนั้น
// และแชร์ผ่าน LINE ได้จริง (line.me/R/msg/text). สถานะเพื่อนที่ "ยังไม่นับ" = อีกฝั่งยังไม่สมัครผ่านโค้ด.
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { QiHeader } from "./QiHeader"
import type { QiCatalog, Referral } from "../qi-model"

const CARD = "v3-shadow-card w-full rounded-[20px] bg-white p-5"

export function ReferralHubScreen() {
  const [referral, setReferral] = useState<Referral | null>(null)
  const [referralBonus, setReferralBonus] = useState<Array<{ code: string; qi: number; title: string }>>([])
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [refInput, setRefInput] = useState("")
  const [refMsg, setRefMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [r, cat] = await Promise.all([
        fetch("/api/referral"),
        fetch("/api/qi-catalog").catch(() => null),
      ])
      if (r.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (!r.ok) {
        setFailed(true)
        return
      }
      setReferral((await r.json()) as Referral)
      if (cat?.ok) {
        const c = (await cat.json()) as QiCatalog
        setReferralBonus(
          c.earn.filter((l) => l.code.startsWith("referral_")).map((l) => ({ code: l.code, qi: l.qi, title: l.title })),
        )
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

  const shareUrl = () => `${window.location.origin}/invite/${referral?.code ?? ""}`
  const shareText = () => `มาสะสมชี่กับ MuMate กัน! สมัครผ่านโค้ดของฉัน ${referral?.code ?? ""} → ${shareUrl()}`

  const copyCode = async () => {
    if (!referral?.code) return
    await navigator.clipboard.writeText(shareText()).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
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
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    setRefMsg(res.ok ? "รับโบนัสสำเร็จ! ได้เหรียญคนละกองเลย" : String(j.error ?? "โค้ดไม่ถูกต้อง หรือใช้ไปแล้ว"))
    if (res.ok) {
      setRefInput("")
      await load()
    }
  }

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-white pb-10">
      <div className="mx-auto w-full max-w-md px-4">
        <QiHeader title="ชวนเพื่อน" testId="referral-hub" />

        {loading && (
          <div className="mt-3" data-testid="referral-hub-loading">
            <div className="h-[150px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
          </div>
        )}

        {!loading && guard === "not_authenticated" && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="referral-hub-guard-auth">
            <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
            <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              เข้าสู่ระบบ
            </Link>
          </div>
        )}

        {!loading && !guard && failed && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="referral-hub-error">
            <p className="text-sm font-bold text-v3-navy">โหลดข้อมูลไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </div>
        )}

        {!loading && !guard && !failed && referral && (
          <div className="mt-3 flex flex-col gap-4">
            {/* โค้ดของฉัน + แชร์ */}
            <section className="rounded-[20px] bg-v3-sapphire p-5 text-white" data-testid="referral-hero">
              <p className="text-[12px] leading-4 text-white/80">โค้ดแนะนำของคุณ</p>
              <p className="mt-1 text-[28px] font-black leading-9 tracking-wider" data-testid="referral-code">
                {referral.code ?? "······"}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={copyCode}
                  data-testid="referral-copy"
                  className="grid h-11 flex-1 place-items-center rounded-full bg-white/15 text-[13px] font-bold text-white"
                >
                  {copied ? "คัดลอกแล้ว!" : "คัดลอกข้อความแชร์"}
                </button>
                {/* แชร์เข้า LINE ตรง — เพื่อนเห็นข้อความ + ลิงก์ /invite ตาม frame `share-code to friend` */}
                <a
                  href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText())}`}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="referral-share-line"
                  className="grid h-11 flex-1 place-items-center rounded-full bg-[#06C755] text-[13px] font-bold text-white"
                >
                  แชร์ผ่าน LINE
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/70">
                เพื่อนเปิดลิงก์แล้วสมัครผ่านโค้ดของคุณเท่านั้น — ถึงจะนับเป็นการชวน
              </p>
            </section>

            {/* เฟรม `share-code — what the friend sees in LINE`: ตัวอย่างแชทที่เพื่อนจะได้รับ —
                ข้อความตรงกับปุ่มแชร์ด้านบน (shareText เดียวกัน) กัน copy สองที่ไม่ตรงกัน */}
            <section className={CARD} data-testid="referral-line-preview">
              <h2 className="text-base font-bold text-v3-navy">สิ่งที่เพื่อนจะเห็นใน LINE</h2>
              <div className="mt-3 rounded-[18px] rounded-tl-[4px] bg-v3-ghost-white p-3">
                <p className="text-[13px] leading-5 text-v3-navy" data-testid="referral-line-text">
                  {referral.code ? shareText() : "…"}
                </p>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-v3-text-muted">
                เพื่อนกดลิงก์ → เห็นหน้าคำเชิญ → สมัครผ่านโค้ด ระบบนับเป็นการชวนให้อัตโนมัติ
              </p>
            </section>

            {/* สรุปผลชวน */}
            <section className={CARD} data-testid="referral-stats">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] leading-4 text-v3-text-muted">เพื่อนที่ใช้โค้ดแล้ว</p>
                  <p className="text-[24px] font-black leading-8 text-v3-navy" data-testid="referral-invited-count">
                    {referral.invitedCount ?? 0} คน
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] leading-4 text-v3-text-muted">โบนัสต่อการชวน</p>
                  <p className="text-[24px] font-black leading-8 text-v3-navy" data-testid="referral-per-invite">
                    +{referral.rewardPerInvite ?? 250} เหรียญ
                  </p>
                </div>
              </div>
            </section>

            {/* โบนัสชวนเพื่อนทั้งหมด — ตัวเลขจาก catalog ของ engine */}
            {referralBonus.length > 0 && (
              <section className={CARD} data-testid="referral-bonus-list">
                <h2 className="text-base font-bold text-v3-navy">ชวนเพื่อน รับโบนัส</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {referralBonus.map((b) => (
                    <div key={b.code} className="flex items-center justify-between gap-3 rounded-[14px] border border-v3-border-card px-3 py-3">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-v3-navy">{b.title}</p>
                      <span className="flex-none rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-black text-v3-navy">+{b.qi} ชี่</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-v3-text-muted">
                  เพื่อนสมัครผ่านโค้ด: เพื่อนได้ +100 เหรียญ คุณได้ +250 เหรียญ (ใช้โค้ดได้คนละ 1 ครั้งตลอดชีพ)
                </p>
              </section>
            )}

            {/* กรอกโค้ดเพื่อน */}
            <section className={CARD} data-testid="referral-apply">
              <h2 className="text-base font-bold text-v3-navy">มีโค้ดเพื่อน?</h2>
              <p className="mt-1 text-[12px] leading-4 text-v3-text-body">กรอกโค้ดของเพื่อนรับโบนัส +100 เหรียญทันที</p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="เช่น MUMATE123"
                  data-testid="referral-hub-input"
                  className="h-11 min-w-0 flex-1 rounded-full border border-v3-border-input bg-white px-4 text-[13px] text-v3-text-filled outline-none placeholder:text-v3-placeholder"
                />
                <button
                  onClick={applyReferral}
                  disabled={!refInput.trim()}
                  data-testid="referral-hub-apply"
                  className="grid h-11 flex-none place-items-center rounded-full bg-v3-cyan px-4 text-[12px] font-bold text-white disabled:opacity-40"
                >
                  ใช้โค้ด
                </button>
              </div>
              {refMsg && (
                <p data-testid="referral-hub-msg" className="mt-2 text-[12px] font-medium text-v3-sapphire">
                  {refMsg}
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReferralHubScreen

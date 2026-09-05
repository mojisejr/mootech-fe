// features/v2-qi/components/ReferralHubScreen.tsx — จอ "ชวนเพื่อน" เต็ม (/v2/qi/referral).
// เฟรม `referral - hub` (55399:7106): hero (ภาพ + โค้ด dashed + คัดลอก) → ช่องแชร์ (LINE/FB/ลิงก์/เพิ่มเติม)
// → สรุป 3 ค่า (ชวนสำเร็จ/รอเริ่มใช้/ได้รับแล้ว) → เป้า 5 ธาตุ (มาสคอต+เครื่องหมายสำเร็จ) → กรอกโค้ดเพื่อน.
// รางวัลจริง: ผู้ชวน +50 QI · เพื่อน +30 QI (เมื่อเพื่อนกรอกวันเกิด+เช็คอินครั้งแรก). ข้อมูลเป้าจาก /api/missions.
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { SectionCard, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import type { MissionBoard, Referral } from "../qi-model"

const REWARD_INVITER = 50
const REWARD_FRIEND = 30

const ELEMENTS: Array<{ key: string; label: string; mascot: string; bg: string }> = [
  { key: "wood", label: "ธาตุไม้", mascot: "mascot-wood", bg: "#E6F4EC" },
  { key: "metal", label: "ธาตุทอง", mascot: "mascot-metal", bg: "#E1E1E1" },
  { key: "fire", label: "ธาตุไฟ", mascot: "mascot-fire", bg: "#FBEAE8" },
  { key: "earth", label: "ธาตุดิน", mascot: "mascot-earth", bg: "#F7EEE1" },
  { key: "water", label: "ธาตุน้ำ", mascot: "mascot-water", bg: "#E4F1F7" },
]

const LINK_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#464646" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
const MORE_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="#464646"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>

function Channel({ label, children, href, onClick, testId }: { label: string; children: React.ReactNode; href?: string; onClick?: () => void; testId?: string }) {
  const inner = (
    <>
      <span className="grid size-[30px] place-items-center overflow-hidden rounded-[15px]">{children}</span>
      <span className="text-[10px] font-medium text-v3-text-body">{label}</span>
    </>
  )
  const cls = "flex flex-1 flex-col items-center gap-1.5 rounded-[14px] border border-v3-border-card bg-white py-3"
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" data-testid={testId} className={cls}>{inner}</a>
  ) : (
    <button type="button" onClick={onClick} data-testid={testId} className={cls}>{inner}</button>
  )
}

export function ReferralHubScreen() {
  const [referral, setReferral] = useState<Referral | null>(null)
  const [board, setBoard] = useState<MissionBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [guard, setGuard] = useState<"not_authenticated" | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const [refInput, setRefInput] = useState("")
  const [refMsg, setRefMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const [r, m] = await Promise.all([fetch("/api/referral"), fetch("/api/missions").catch(() => null)])
      if (r.status === 401) {
        setGuard("not_authenticated")
        return
      }
      if (!r.ok) {
        setFailed(true)
        return
      }
      setReferral((await r.json()) as Referral)
      if (m?.ok) setBoard((await m.json()) as MissionBoard)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const shareUrl = () => `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${referral?.code ?? ""}`
  const shareText = () => `มาสะสม QI กับ MuMate กัน! สมัครผ่านโค้ดของฉัน ${referral?.code ?? ""} → ${shareUrl()}`
  const flash = (k: "code" | "link") => { setCopied(k); window.setTimeout(() => setCopied(null), 2000) }
  const copyCode = async () => { if (!referral?.code) return; await navigator.clipboard.writeText(shareText()).catch(() => {}); flash("code") }
  const copyLink = async () => { if (!referral?.code) return; await navigator.clipboard.writeText(shareUrl()).catch(() => {}); flash("link") }
  const moreShare = () => { if (navigator.share) void navigator.share({ text: shareText(), url: shareUrl() }).catch(() => {}); else void copyLink() }

  const applyReferral = async () => {
    const code = refInput.trim()
    if (!code) return
    setRefMsg(null)
    const res = await fetch("/api/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    setRefMsg(res.ok ? `รับโบนัสสำเร็จ! คุณได้ +${REWARD_FRIEND} QI` : String(j.error ?? "โค้ดไม่ถูกต้อง หรือใช้ไปแล้ว"))
    if (res.ok) { setRefInput(""); await load() }
  }

  const goals = board?.goals
  const invited = goals?.referral.invited ?? referral?.invitedCount ?? 0
  const earnedQi = goals?.referral.earnedQi ?? invited * REWARD_INVITER
  const pending = Math.max(0, (referral?.invitedCount ?? invited) - invited)
  const collectedKeys = new Set((goals?.element.elements ?? []).filter((e) => e.collected).map((e) => e.key))
  const missing = ELEMENTS.filter((e) => !collectedKeys.has(e.key)).map((e) => e.label)

  return (
    <SkyScreen>
      <Head><title>ชวนเพื่อน · MuMate</title></Head>
      <SkyHeader title="ชวนเพื่อน" testId="referral-hub" />

      {loading && (
        <div className="mt-3" data-testid="referral-hub-loading">
          <div className="h-[320px] w-full animate-pulse rounded-[20px] bg-v3-sapphire/20" />
        </div>
      )}

      {!loading && guard === "not_authenticated" && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="referral-hub-guard-auth">
          <p className="text-sm font-bold text-v3-navy">ไม่พบข้อมูลผู้ใช้</p>
          <Link href="/v2/login" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-sapphire text-sm font-bold uppercase text-v3-lime">เข้าสู่ระบบ</Link>
        </div>
      )}

      {!loading && !guard && failed && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="referral-hub-error">
          <p className="text-sm font-bold text-v3-navy">โหลดข้อมูลไม่สำเร็จ</p>
          <button onClick={() => void load()} className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-sm font-bold uppercase text-v3-lime">ลองใหม่</button>
        </div>
      )}

      {!loading && !guard && !failed && referral && (
        <div className="mt-3 flex flex-col gap-4">
          {/* hero: ภาพ + หัวข้อ lime + สรุปรางวัล + โค้ด dashed + คัดลอก */}
          <section className="flex flex-col items-center gap-3 overflow-hidden rounded-[20px] bg-v3-sapphire px-5 pb-5 pt-5" data-testid="referral-hero">
            <span className="relative aspect-[361/266] w-full overflow-hidden rounded-[14px]">
              <Image src="/images/v2/referral/hero.png" alt="" fill sizes="361px" className="object-cover" />
            </span>
            <h2 className="text-center text-[20px] font-bold leading-7 text-v3-lime">ชวนเพื่อน รับคนละ {REWARD_INVITER} QI</h2>
            <p className="text-center text-[12px] leading-[18px] text-white/90">
              เพื่อนที่สมัครใหม่รับ {REWARD_FRIEND} QI ทันที ส่วนคุณรับ {REWARD_INVITER} QI เมื่อเพื่อนกรอกวันเกิดและเช็คอินครั้งแรก
            </p>
            <div className="flex w-full items-center gap-2 rounded-[14px] border border-dashed border-white/50 bg-white py-2 pl-4 pr-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-wider text-v3-navy" data-testid="referral-code">{referral.code ?? "······"}</span>
              <button onClick={copyCode} className="flex-none rounded-full bg-v3-sapphire px-3.5 py-2 text-[9px] font-black uppercase text-v3-lime">{copied === "code" ? "คัดลอกแล้ว" : "คัดลอก"}</button>
            </div>
          </section>

          {/* แชร์ลิงก์ชวนเพื่อน */}
          <p className="text-center text-[16px] font-bold uppercase text-v3-sapphire">แชร์ลิงก์ชวนเพื่อน</p>
          <div className="flex items-start gap-2">
            <Channel label="LINE" testId="referral-share-line" href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText())}`}>
              <Image src="/images/v2/referral/line-icon.png" alt="" width={30} height={30} className="size-full object-cover" />
            </Channel>
            <Channel label="Facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`}>
              <span className="grid size-full place-items-center rounded-[15px] bg-[#1877F2] text-[16px] font-extrabold text-white">f</span>
            </Channel>
            <Channel label={copied === "link" ? "คัดลอกแล้ว" : "คัดลอกลิงก์"} onClick={copyLink}>
              <span className="grid size-full place-items-center rounded-[15px] bg-[#E8E8E8]">{LINK_ICON}</span>
            </Channel>
            <Channel label="เพิ่มเติม" onClick={moreShare}>
              <span className="grid size-full place-items-center rounded-[15px] bg-[#E8E8E8]">{MORE_ICON}</span>
            </Channel>
          </div>

          {/* สรุป 3 ค่า */}
          <section className="flex items-center rounded-[18px] border border-v3-border-card bg-white py-4 text-center" data-testid="referral-stats">
            <div className="flex-1 px-1">
              <p className="text-[12px] text-v3-text-body">ชวนสำเร็จ</p>
              <p className="text-[14px] font-semibold text-[#63B05F]" data-testid="referral-invited-count">{invited.toLocaleString("th-TH")} คน</p>
            </div>
            <div className="h-[34px] w-px bg-v3-border-card" />
            <div className="flex-1 px-1">
              <p className="text-[12px] text-v3-text-body">รอเพื่อนเริ่มใช้</p>
              <p className="text-[16px] font-bold text-v3-text-muted">{pending.toLocaleString("th-TH")} คน</p>
            </div>
            <div className="h-[34px] w-px bg-v3-border-card" />
            <div className="flex-1 px-1">
              <p className="text-[12px] text-v3-text-body">ได้รับแล้ว</p>
              <p className="text-[14px] font-semibold text-[#63B05F]" data-testid="referral-per-invite">{earnedQi.toLocaleString("th-TH")} QI</p>
            </div>
          </section>

          {/* เป้า 5 ธาตุ */}
          <SectionCard className="!rounded-[18px]" testId="referral-element-goal">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-v3-navy">สะสมเพื่อนครบ 5 ธาตุ</h2>
              <span className="rounded-[10px] bg-[#E3F8D1] px-2.5 py-1 text-[14px] font-semibold text-[#63B05F]">+1,000 QI</span>
            </div>
            <div className="mt-2 flex items-start justify-between">
              {ELEMENTS.map((e) => {
                const got = collectedKeys.has(e.key)
                return (
                  <div key={e.key} className="flex flex-col items-center gap-1.5">
                    <span className="relative grid size-14 place-items-center overflow-hidden rounded-[16px]" style={{ backgroundColor: e.bg, border: got ? "1px solid #63B05F" : undefined }}>
                      <Image src={`/images/v2/referral/${e.mascot}.png`} alt="" width={33} height={41} className="h-[41px] w-[33px] object-contain" />
                      {got ? <img src="/images/v2/referral/success-mark.svg" alt="" aria-hidden className="absolute -right-1 -top-1 size-5" /> : null}
                    </span>
                    <span className="text-[13px] font-medium text-v3-navy">{e.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-1 text-[12px] leading-[18px] text-v3-text-muted">
              ธาตุของเพื่อนคำนวณจากวันเกิด{missing.length && missing.length < 5 ? ` ตอนนี้ยังขาด${missing.join(" และ ")}` : ""}
            </p>
          </SectionCard>

          {/* เพื่อนที่ชวน (รายชื่อ + โบนัสต่อคน) */}
          {referral.friends && referral.friends.length > 0 ? (
            <SectionCard className="!rounded-[18px]" testId="referral-friends">
              <h2 className="text-[16px] font-bold text-v3-navy">เพื่อนที่ชวน</h2>
              <ul className="mt-2 flex flex-col divide-y divide-v3-border-card">
                {referral.friends.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-[#EAF3FF] text-[13px] font-black text-v3-sapphire">
                      {f.name.replace(/^@/, "").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-v3-navy">{f.name}</p>
                      {f.joinedAt ? <p className="text-[11px] leading-4 text-v3-text-muted">{new Date(f.joinedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</p> : null}
                    </div>
                    <span className="flex-none text-[13px] font-black text-[#63B05F]">+{(f.rewardQi ?? REWARD_INVITER).toLocaleString("th-TH")} QI</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {/* กรอกโค้ดเพื่อน (ฟีเจอร์จริง) */}
          <SectionCard className="!rounded-[18px]" testId="referral-apply">
            <h2 className="text-[16px] font-bold text-v3-navy">มีโค้ดเพื่อน?</h2>
            <p className="mt-1 text-[12px] leading-4 text-v3-text-body">กรอกโค้ดของเพื่อนรับโบนัส +{REWARD_FRIEND} QI ทันที</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="เช่น MUMATE123"
                data-testid="referral-hub-input"
                className="h-11 min-w-0 flex-1 rounded-full border border-v3-border-input bg-white px-4 text-[13px] text-v3-text-filled outline-none placeholder:text-v3-placeholder"
              />
              <button onClick={applyReferral} disabled={!refInput.trim()} data-testid="referral-hub-apply" className="grid h-11 flex-none place-items-center rounded-full bg-v3-sapphire px-5 text-[12px] font-bold uppercase text-v3-lime disabled:opacity-40">ใช้โค้ด</button>
            </div>
            {refMsg && <p data-testid="referral-hub-msg" className="mt-2 text-[12px] font-medium text-v3-sapphire">{refMsg}</p>}
          </SectionCard>

          <p className="px-1 text-center text-[9px] leading-4 text-v3-text-muted">เพื่อนที่เปิดลิงก์แต่ยังไม่สมัคร จะไม่นับและไม่ถูกเก็บข้อมูลติดต่อ</p>
        </div>
      )}
    </SkyScreen>
  )
}

export default ReferralHubScreen

// pages/invite/[code].tsx — จุดรับ deep link ชวนเพื่อน (team.mp4: ลิงก์กลาง mumate.com/invite/MUMATE123)
// + เฟรม `invite-landing — friend opens the link` (55399:5838): หน้าต้อนรับของคนที่เปิดลิงก์เพื่อน
//   logo + hero + การ์ด "รับ 30 QI ฟรี" + โค้ด + "Mumate ทำอะไรได้บ้าง" + สมัครด้วย LINE.
//
// 🔴 ผู้รับลิงก์ส่วนใหญ่ยังไม่ล็อกอิน และหน้า /v2/register จะเด้งกลับ /v2 จนกว่าจะล็อกอิน — โค้ดจึง
// เก็บลง localStorage (REFERRAL_STORAGE_KEY) ตอน "ยอมรับคำเชิญ" แล้วค่อยพาไปหน้าสมัคร เพื่อให้โค้ด
// รออยู่จนถึงหน้าสมัครจริง (register-referral อ่านคีย์นี้)
//
// สถานะ: loading → ready (มีชื่อผู้ชวนถ้ามี @name) · โค้ดเน่า/หมดอายุ → แจ้งตรง ๆ + ทางสมัครปกติ.
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { shareSnapshot } from "@/lib/db/schema"
import { gradeTier, TIER_INK } from "@/lib/v2/grade-scale"

export const REFERRAL_STORAGE_KEY = 'v2:referral'

const CODE_RE = /^[A-Za-z0-9]{4,32}$/

type Look = { code?: string; inviterName?: string | null }

// SSR OG card (ซินแส 2026-09-12): /invite ไม่โดน v2 gate → scraper เข้าถึงได้ แต่เดิมไม่มี og:* เลย
// (card ขึ้น "MuMate · preview"). ดึงชื่อผู้ชวนฝั่ง server แล้วปล่อย og ให้ FB/LINE ทำ rich preview.
// #359 รอบ 13: พารามิเตอร์การ์ดแชร์เฉพาะผล (t/s/d/g/m) ที่ติดมากับลิงก์ → ใช้ทำ og:image เฉพาะบุคคล
type ShareOg = { t?: string; s?: string; d?: string; g?: string; m?: string; k?: string }
// เปิดเผย (0033): ถ้าเจ้าของยินยอม → มีคำทำนายเต็มให้คนอื่นอ่าน (readingFull) พร้อมหัวข้อ (readingTitle)
type InviteSSR = { ssrCode: string; ssrInviterName: string | null; origin: string; share: ShareOg; shareUrl: string; readingTitle: string | null; readingFull: string | null }

export const getServerSideProps: GetServerSideProps<InviteSSR> = async (ctx) => {
  const raw = ctx.params?.code
  const ssrCode = (Array.isArray(raw) ? raw[0] : raw ?? "").trim()
  const proto = (ctx.req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https"
  const host = ctx.req.headers.host ?? ""
  const origin = `${proto}://${host}`
  let ssrInviterName: string | null = null
  const upper = ssrCode.toUpperCase()
  if (/^MUMATE\d{3}$/.test(upper)) {
    try {
      const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
      const r = await fetch(`${base}/api/referral?code=${encodeURIComponent(upper)}`)
      if (r.ok) {
        const j = (await r.json()) as { inviterName?: string | null }
        ssrInviterName = typeof j.inviterName === "string" && j.inviterName ? j.inviterName : null
      }
    } catch {
      /* best-effort — การ์ดยังขึ้นแบบทั่วไปได้ถ้าดึงชื่อไม่ได้ */
    }
  }
  // การ์ดแชร์เฉพาะผล → og:image เฉพาะบุคคล.
  // รอบ 14: ลิงก์สั้น — โค้ด ?c=<id> อ่านสแนปช็อตจาก DB (ฝั่ง server). รองรับ ?t/s/d/g/m เดิมด้วย (ลิงก์เก่า).
  const q = ctx.query
  const str = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "")
  let share: ShareOg = { t: str(q.t), s: str(q.s), d: str(q.d), g: str(q.g), m: str(q.m) }
  let readingTitle: string | null = null
  let readingFull: string | null = null
  const snapId = str(q.c).trim()
  if (snapId && /^[0-9A-Za-z]{1,24}$/.test(snapId)) {
    try {
      // เลือกเฉพาะคอลัมน์เดิม (การ์ด OG) — ไม่แตะคอลัมน์ 0033 ตรงนี้ กัน SELECT พังถ้ายังไม่รัน migration
      const rows = await db
        .select({ title: shareSnapshot.title, subtitle: shareSnapshot.subtitle, summary: shareSnapshot.summary, tag: shareSnapshot.tag, image: shareSnapshot.image, skills: shareSnapshot.skills })
        .from(shareSnapshot).where(eq(shareSnapshot.id, snapId)).limit(1)
      const r = rows[0]
      if (r) share = { t: r.title, s: r.subtitle ?? "", d: r.summary ?? "", g: r.tag ?? "", m: r.image ?? "", k: r.skills ?? "" }
      // เจ้าของยินยอมเปิดเผย → อ่านคำทำนายเต็มได้ (แยก query + try เผื่อยังไม่รัน migration 0033)
      try {
        const pub = await db.select({ isPublic: shareSnapshot.isPublic, fullText: shareSnapshot.fullText }).from(shareSnapshot).where(eq(shareSnapshot.id, snapId)).limit(1)
        if (pub[0]?.isPublic && pub[0]?.fullText) { readingTitle = share.t ?? null; readingFull = pub[0].fullText }
      } catch { /* ยังไม่รัน migration 0033 → ไม่มีอ่านเต็ม (การ์ด OG ยังทำงาน) */ }
    } catch {
      /* best-effort — ดึงสแนปช็อตไม่ได้ → การ์ดแบรนด์ทั่วไป */
    }
  }
  // og:url = URL เต็มที่แชร์จริง (รวม ?c=) — สำคัญกับ FB feed: FB ยึด og:url เป็น canonical แล้ว scrape ซ้ำ.
  // ถ้า og:url ตัด ?c= ออก FB จะดึงหน้า /invite เปล่า → ได้การ์ด referral ทั่วไป (ไม่ใช่ผลเฉพาะบุคคล).
  const shareUrl = `${origin}${ctx.resolvedUrl}`
  ctx.res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600")
  return { props: { ssrCode, ssrInviterName, origin, share, shareUrl, readingTitle, readingFull } }
}

const FEATURES: { title: string; sub: string; icon: React.ReactNode; tone: string }[] = [
  { title: "ดวงประจำวัน", sub: "อ่านฟรีทุกวัน ไม่ต้องจ่าย", tone: "bg-[#FDF3E0] text-[#E5A93B]", icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>) },
  { title: "เปิดไพ่และเซียมซี", sub: "10 QI ต่อครั้ง", tone: "bg-[#F3E9FA] text-[#6F1BAF]", icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="12" height="17" rx="2" /><path d="M18 6l2 .7a2 2 0 0 1 1.2 2.5l-3 9" /></svg>) },
  { title: "ถามเซียนมู่ AI", sub: "30 QI ต่อครั้ง", tone: "bg-[#E3F4F7] text-[#14707E]", icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
]

export default function InvitePage({ ssrCode = "", ssrInviterName = null, origin = "", share = {}, shareUrl = "", readingTitle = null, readingFull = null }: Partial<InviteSSR>) {
  const router = useRouter()
  const { code: rawCode } = router.query
  const code = (Array.isArray(rawCode) ? rawCode[0] : rawCode) ?? ssrCode
  const valid = typeof code === "string" && CODE_RE.test(code)

  const [state, setState] = useState<"loading" | "ready" | "dead" | "unknown">("loading")
  const [inviterName, setInviterName] = useState<string | null>(ssrInviterName)

  // OG (SSR) — ใช้ค่าจาก server เพื่อให้ scraper เห็น meta ตรงกับผู้ชวน
  // #359 รอบ 13: ถ้าลิงก์พก share params (t/d/...) → og:image = การ์ดเฉพาะผล (/api/og/share), ไม่งั้นใช้รูปแบรนด์เดิม
  const hasShare = !!(share.t || share.d)
  const ogTitle = share.t
    ? share.t
    : ssrInviterName ? `คุณ ${ssrInviterName} ชวนคุณใช้ MuMate — รับ 30 QI ฟรี` : "MuMate — รับ 30 QI ฟรีเมื่อสมัคร"
  const ogDesc = share.d || "ปฏิทินดวงจีน ดูดวงรายวัน เปิดไพ่ และถามเซียนมู่ AI — สมัครผ่านลิงก์นี้รับ 30 QI ฟรีทันที"
  const ogImage = hasShare
    ? `${origin}/api/og/share?${new URLSearchParams(Object.entries(share).filter(([, v]) => v) as [string, string][]).toString()}`
    : `${origin}/images/v2/referral/hero.png`
  // FB feed ยึด og:url เป็น canonical → ต้องเป็น URL ที่มี ?c= (ผลเฉพาะบุคคล) ไม่งั้นได้การ์ด referral ทั่วไป
  const pageUrl = hasShare && shareUrl ? shareUrl : `${origin}/invite/${encodeURIComponent(ssrCode)}`

  useEffect(() => {
    if (!code) return // router ยัง hydrate ไม่เสร็จ
    if (!valid) {
      setState("dead")
      return
    }
    let alive = true
    fetch(`/api/invite-look?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Look) => {
        if (!alive) return
        setInviterName(typeof j.inviterName === "string" && j.inviterName ? j.inviterName : null)
        setState("ready")
      })
      .catch((e: Error) => {
        if (!alive) return
        setState(e.message === "404" || e.message === "400" ? "dead" : "unknown")
      })
    return () => {
      alive = false
    }
  }, [code, valid])

  const accept = () => {
    if (valid) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, code)
      router.replace(`/v2/register?ref=${encodeURIComponent(code)}`)
      return
    }
    router.replace("/v2/register")
  }

  /** ทางสมัครปกติ — ไม่เก็บโค้ด (ใช้เมื่อโค้ดตายจริง ไม่พาโค้ดเน่าไปสมัคร) */
  const goRegisterPlain = () => {
    router.replace("/v2/register")
  }

  const retry = () => {
    setState("loading")
    router.replace(`/invite/${code}`) // โหลดใหม่ทั้ง route เพื่อยิง invite-look รอบใหม่
  }

  return (
    <div className="font-ibm flex min-h-[100dvh] w-full flex-col items-center bg-v3-bg-cream px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="MuMate" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

      {/* โลโก้ */}
      <Image src="/images/v2/logo/splash-logo.png" alt="Mumate" width={132} height={40} className="h-9 w-auto object-contain" priority />

      {state === "loading" && (
        <div className="mt-10 flex w-full max-w-md flex-col items-center gap-3">
          <div aria-hidden className="size-16 animate-pulse rounded-full bg-v3-ghost-white" />
          <p data-testid="invite-loading" className="text-sm font-bold text-v3-navy">กำลังตรวจสอบคำเชิญ…</p>
        </div>
      )}

      {state === "dead" && (
        <div className="v3-shadow-card mt-10 w-full max-w-md rounded-[24px] bg-white p-6 text-center">
          <h1 data-testid="invite-invalid-title" className="text-lg font-black text-v3-navy">ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
          <p className="mt-1 text-[13px] leading-5 text-v3-text-body">โค้ดอาจผิดพลาดหรือถูกลบไปแล้ว — ยังสมัครใช้งาน MuMate ได้ตามปกติ</p>
          <button onClick={goRegisterPlain} data-testid="invite-accept-anyway" className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold uppercase text-v3-lime">
            ไปหน้าสมัคร
          </button>
        </div>
      )}

      {state === "unknown" && (
        <div className="v3-shadow-card mt-10 w-full max-w-md rounded-[24px] bg-white p-6 text-center">
          <h1 data-testid="invite-unknown-title" className="text-lg font-black text-v3-navy">ตรวจสอบคำเชิญไม่สำเร็จ</h1>
          <p className="mt-1 text-[13px] leading-5 text-v3-text-body">ขัดข้องชั่วคราว — ลองอีกครั้ง หรือสมัครด้วยโค้ดตอนหน้าสมัครได้</p>
          <button onClick={retry} data-testid="invite-retry" className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-base font-bold uppercase text-v3-lime">
            ลองใหม่
          </button>
          <button onClick={accept} data-testid="invite-accept-anyway" className="mt-2 grid h-11 w-full place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy">
            ไปหน้าสมัคร
          </button>
        </div>
      )}

      {state === "ready" && (
        <div className="mt-4 flex w-full max-w-md flex-col gap-4">
          {/* คำทำนายที่แชร์ (เจ้าของยินยอมเปิดเผย 0033) — รูปการ์ด + สรุป + ผลเต็ม */}
          {readingFull ? (
            <section data-testid="invite-reading" className="v3-shadow-card rounded-[24px] bg-white p-5">
              <span className="w-fit rounded-full bg-v3-sapphire/10 px-3 py-1 text-[11px] font-black tracking-wide text-v3-sapphire">คำทำนายที่แชร์</span>
              {readingTitle ? <h2 className="mt-2 text-[17px] font-black leading-6 text-v3-navy">{readingTitle}</h2> : null}
              {/* รูปการ์ด/มาสคอต (จาก snapshot.image คั่นด้วย ",") */}
              {share.m ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {share.m.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" className="h-32 w-auto rounded-[12px] object-contain" />
                  ))}
                </div>
              ) : null}
              {/* สรุป (จาก snapshot.summary) */}
              {share.d ? (
                <div className="mt-3 rounded-2xl bg-[#EAF3FF] p-4">
                  <span className="text-[12px] font-black text-v3-sapphire">สรุปคำทำนายนี้</span>
                  <p className="mt-1 text-[13px] leading-[22px] text-v3-text-body">{share.d}</p>
                </div>
              ) : null}
              {/* แท่งความเข้ากันรายด้าน (เอ็ม 2026-09-23) — จาก snapshot.skills "label|pct|grade|color|top~..." */}
              {share.k ? (
                <div className="mt-3 flex flex-col gap-2.5">
                  {share.k.split("~").map((row) => row.split("|")).filter((f) => (f[0] ?? "").trim()).map((f, i) => {
                    const [label = "", pct = "0", grade = "", color = "#1455A4"] = f
                    const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)))
                    return (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 text-[13px] font-semibold text-v3-navy">{label}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[12px] font-bold" style={{ color }}>{p}%</span>
                            {grade ? <span className="grid min-w-[36px] place-items-center rounded-full px-2 py-0.5 text-[11px] font-black" style={{ backgroundColor: color, color: TIER_INK[gradeTier(grade)] }}>{grade}</span> : null}
                          </span>
                        </div>
                        <span className="h-2 w-full overflow-hidden rounded-full bg-[#EAECEF]">
                          <span className="block h-full rounded-full" style={{ width: `${p}%`, backgroundColor: color }} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {/* ผลเต็ม */}
              <p className="mt-3 whitespace-pre-line text-[14px] leading-[24px] text-v3-text-body">{readingFull}</p>
              <p className="mt-3 text-[11px] leading-4 text-v3-text-muted">ผู้แชร์ยินยอมเปิดเผยผลนี้ · อยากรู้ดวงของคุณเองไหม? สมัครฟรีด้านล่าง</p>
            </section>
          ) : null}

          {/* hero */}
          <div className="relative h-[200px] w-full overflow-hidden rounded-[24px]">
            <Image src="/images/v2/referral/hero.png" alt="" fill sizes="(max-width:480px) 100vw, 448px" className="object-cover" />
          </div>

          {/* การ์ดรับ 30 QI + โค้ด */}
          <section className="rounded-[24px] bg-v3-sapphire p-5 text-center text-white">
            <h1 data-testid="invite-title" className="text-[20px] font-black leading-7 text-v3-lime">
              {inviterName ? `คุณ ${inviterName} ชวนคุณ — รับ 30 QI ฟรี` : "รับ 30 QI ฟรีทันทีที่สมัคร"}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-white/90">พอสมัครเสร็จ เปิดไพ่ได้ 3 ครั้ง หรือถามเซียนมู่ได้ 1 ครั้ง โดยไม่ต้องจ่ายอะไร</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3 text-left">
              <div className="min-w-0">
                <p data-testid="invite-code" className="truncate text-[16px] font-black tracking-wider text-v3-navy">{code}</p>
                <p className="text-[11px] leading-4 text-v3-text-muted">กรอกโค้ดให้อัตโนมัติ ไม่ต้องพิมพ์เอง</p>
              </div>
              <span className="flex-none rounded-full bg-[#E3F8D1] px-2.5 py-1 text-[11px] font-black text-[#3F8F52]">พร้อมใช้</span>
            </div>
          </section>

          {/* Mumate ทำอะไรได้บ้าง */}
          <section className="v3-shadow-card rounded-[24px] bg-white p-5">
            <p className="text-[16px] font-bold text-v3-navy">Mumate ทำอะไรได้บ้าง</p>
            <div className="mt-3 flex flex-col gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-center gap-3">
                  <span aria-hidden className={`grid size-10 flex-none place-items-center rounded-[12px] ${f.tone}`}>{f.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-v3-navy">{f.title}</p>
                    <p className="text-[12px] leading-4 text-v3-text-muted">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button onClick={accept} data-testid="invite-accept" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-v3-sapphire text-base font-bold uppercase text-v3-lime">
            <Image src="/images/v2/referral/line-icon.png" alt="" width={20} height={20} className="size-5 object-contain" />
            สมัครด้วย LINE รับ 30 QI
          </button>
          <Link href="/v2" data-testid="invite-decline" className="text-center text-[13px] font-bold text-v3-text-muted">
            มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
          </Link>
          <p className="text-center text-[11px] leading-4 text-v3-text-muted">ต้องกรอกวันเกิดเพื่อรับดวงต่อเนื่อง · ยกเลิกบัญชีได้ทุกเมื่อ</p>
        </div>
      )}
    </div>
  )
}

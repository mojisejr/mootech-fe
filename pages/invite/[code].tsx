// pages/invite/[code].tsx — จุดรับ deep link ชวนเพื่อน (team.mp4: ลิงก์กลาง mumate.com/invite/MUMATE123)
// + เฟรม `invite-landing — friend opens the link` (55399:5838): หน้าต้อนรับของคนที่เปิดลิงก์เพื่อน
//   logo + hero + การ์ด "รับ 30 QI ฟรี" + โค้ด + "Mumate ทำอะไรได้บ้าง" + สมัครด้วย LINE.
//
// 🔴 ผู้รับลิงก์ส่วนใหญ่ยังไม่ล็อกอิน และหน้า /v2/register จะเด้งกลับ /v2 จนกว่าจะล็อกอิน — โค้ดจึง
// เก็บลง localStorage (REFERRAL_STORAGE_KEY) ตอน "ยอมรับคำเชิญ" แล้วค่อยพาไปหน้าสมัคร เพื่อให้โค้ด
// รออยู่จนถึงหน้าสมัครจริง (register-referral อ่านคีย์นี้)
//
// สถานะ: loading → ready (มีชื่อผู้ชวนถ้ามี @name) · โค้ดเน่า/หมดอายุ → แจ้งตรง ๆ + ทางสมัครปกติ.
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

export const REFERRAL_STORAGE_KEY = 'v2:referral'

const CODE_RE = /^[A-Za-z0-9]{4,32}$/

type Look = { code?: string; inviterName?: string | null }

const FEATURES: { title: string; sub: string; icon: React.ReactNode; tone: string }[] = [
  { title: "ดวงประจำวัน", sub: "อ่านฟรีทุกวัน ไม่ต้องจ่าย", tone: "bg-[#FDF3E0] text-[#E5A93B]", icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>) },
  { title: "เปิดไพ่และเซียมซี", sub: "10 QI ต่อครั้ง", tone: "bg-[#F3E9FA] text-[#6F1BAF]", icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="12" height="17" rx="2" /><path d="M18 6l2 .7a2 2 0 0 1 1.2 2.5l-3 9" /></svg>) },
  { title: "ถามเซียนมู AI", sub: "30 QI ต่อครั้ง", tone: "bg-[#E3F4F7] text-[#14707E]", icon: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
]

export default function InvitePage() {
  const router = useRouter()
  const { code: rawCode } = router.query
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode
  const valid = typeof code === "string" && CODE_RE.test(code)

  const [state, setState] = useState<"loading" | "ready" | "dead" | "unknown">("loading")
  const [inviterName, setInviterName] = useState<string | null>(null)

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
        <title>คำเชิญสมัคร MuMate</title>
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
          {/* hero */}
          <div className="relative h-[200px] w-full overflow-hidden rounded-[24px]">
            <Image src="/images/v2/referral/hero.png" alt="" fill sizes="(max-width:480px) 100vw, 448px" className="object-cover" />
          </div>

          {/* การ์ดรับ 30 QI + โค้ด */}
          <section className="rounded-[24px] bg-v3-sapphire p-5 text-center text-white">
            <h1 data-testid="invite-title" className="text-[20px] font-black leading-7 text-v3-lime">
              {inviterName ? `คุณ ${inviterName} ชวนคุณ — รับ 30 QI ฟรี` : "รับ 30 QI ฟรีทันทีที่สมัคร"}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-white/90">พอสมัครเสร็จ เปิดไพ่ได้ 3 ครั้ง หรือถามเซียนมูได้ 1 ครั้ง โดยไม่ต้องจ่ายอะไร</p>
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

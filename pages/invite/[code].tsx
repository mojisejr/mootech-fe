// pages/invite/[code].tsx — จุดรับ deep link ชวนเพื่อน (team.mp4: ลิงก์กลาง mumate.com/invite/MUMATE123)
// + เฟรม `invite-landing — friend opens the link` (ก้อน 5.2): หน้าต้อนรับของคนที่เปิดลิงก์เพื่อน
//
// 🔴 ผู้รับลิงก์ส่วนใหญ่ยังไม่ล็อกอิน และหน้า /v2/register จะเด้งกลับ /v2 จนกว่าจะล็อกอิน — โค้ดจึง
// เก็บลง localStorage (REFERRAL_STORAGE_KEY) ตอน "ยอมรับคำเชิญ" แล้วค่อยพาไปหน้าสมัคร เพื่อให้โค้ด
// รออยู่จนถึงหน้าสมัครจริง (register-referral อ่านคีย์นี้)
//
// สถานะตามเฟรม: loading → landing (มีชื่อผู้ชวนถ้ามี @name) · โค้ดเน่า/หมดอายุ → แจ้งตรง ๆ + ทางสมัครปกติ.
// โค้ดผิดรูปแบบ (regex ไม่ผ่าน) ยังโชว์ landing แบบกลาง ๆ ได้ — การปฏิเสธจริงเกิดตอน submit สมัคร
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

export const REFERRAL_STORAGE_KEY = 'v2:referral'

const CODE_RE = /^[A-Za-z0-9]{4,32}$/

type Look = { code?: string; inviterName?: string | null }

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
        // โค้ดไม่มีจริง (404/400) = ตายตายตัว → พูดตรง ๆ และ "ห้าม" พาโค้ดไปหน้าสมัคร;
        // ฝั่งเราล้มเอง (5xx/network) ❌ ไม่พูดว่าโค้ดเน่า — ให้ลองใหม่ และยังยอมรับโค้ดได้
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
    <div className="font-ibm flex min-h-[100dvh] w-full flex-col items-center justify-center bg-v3-bg-cream px-4">
      <Head>
        <title>คำเชิญสมัคร MuMate</title>
      </Head>

      <div className="v3-shadow-card w-full max-w-md rounded-[24px] bg-white p-6 text-center">
        <span aria-hidden className="v3-float-wide mx-auto block size-16">
          {/* ตรงกับหน้าชี่ — ใช้รูปเหรียญเดียวกัน (🪙 เป็นกล่องโหว่บน Windows 10) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/v2/zone2/coin.png" alt="" className="size-16 object-contain" />
        </span>

        {state === "loading" && (
          <p data-testid="invite-loading" className="mt-4 text-sm font-bold text-v3-navy">กำลังตรวจสอบคำเชิญ…</p>
        )}

        {state === "dead" && (
          <>
            <h1 data-testid="invite-invalid-title" className="mt-3 text-lg font-black text-v3-navy">
              ลิงก์นี้ใช้ไม่ได้แล้ว
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              โค้ดอาจผิดพลาดหรือถูกลบไปแล้ว — ยังสมัครใช้งาน MuMate ได้ตามปกติ
            </p>
            <button
              onClick={goRegisterPlain}
              data-testid="invite-accept-anyway"
              className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white"
            >
              ไปหน้าสมัคร
            </button>
          </>
        )}

        {state === "unknown" && (
          <>
            <h1 data-testid="invite-unknown-title" className="mt-3 text-lg font-black text-v3-navy">
              ตรวจสอบคำเชิญไม่สำเร็จ
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              ขัดข้องชั่วคราว — ลองอีกครั้ง หรือสมัครด้วยโค้ดตอนหน้าสมัครได้
            </p>
            <button
              onClick={retry}
              data-testid="invite-retry"
              className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white"
            >
              ลองใหม่
            </button>
            <button
              onClick={accept}
              data-testid="invite-accept-anyway"
              className="mt-2 grid h-11 w-full place-items-center rounded-full border border-v3-border-card text-sm font-bold text-v3-navy"
            >
              ไปหน้าสมัคร
            </button>
          </>
        )}

        {state === "ready" && (
          <>
            <h1 data-testid="invite-title" className="mt-3 text-lg font-black leading-6 text-v3-navy">
              {inviterName ? `คุณ ${inviterName} ชวนคุณมาสะสมชี่` : "เพื่อนของคุณชวนคุณมาสะสมชี่"}
            </h1>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">
              สมัครด้วยโค้ด <span data-testid="invite-code" className="font-black tracking-wider text-v3-navy">{code}</span>
              {" "}รับโบนัสทันที +100 เหรียญ
            </p>
            <div className="mt-4 rounded-[16px] bg-v3-ghost-white p-3 text-left">
              <p className="text-[11px] leading-4 text-v3-text-muted">รางวัลคู่: เพื่อนที่ชวนได้ +250 เหรียญ · คุณได้ +100 เหรียญ</p>
            </div>
            <button
              onClick={accept}
              data-testid="invite-accept"
              className="mt-4 grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white"
            >
              ยอมรับคำเชิญ & สมัคร
            </button>
            <Link href="/v2" data-testid="invite-decline" className="mt-2 inline-block text-[12px] font-bold text-v3-text-muted">
              ไม่ใช่ตอนนี้
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

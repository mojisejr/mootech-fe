// features/v2-service/components/OrderBookScreen.tsx — ฟอร์มสั่งซื้อหนังสือ "Your Life Code" (#3 ซินแสนุ้ย 2026-09-15)
// ฟิลด์ตามฟอร์มจริง forms.gle/Lf5f7HUdoj3TvKVk9. กรอก → POST /api/v2/book-order (สร้าง book_order NEW) →
// เก็บ id ใน sessionStorage → ไป checkout (PromptPay). จ่ายสำเร็จ → result → BookOrderSuccess (ผูก charge + PAID).
import Head from "next/head"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"

import { KitButton, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { BOOK_ORDER_ID_KEY } from "@/features/v2-shop/components/BookOrderSuccess"

const CARD = "flex w-full flex-col gap-4 rounded-[20px] border border-v3-border-input bg-white p-[18px]"
const INPUT = "h-[52px] w-full rounded-[14px] border border-v3-border-input bg-white px-4 text-[14px] leading-[22px] text-v3-navy placeholder:text-v3-text-note focus:border-v3-sapphire focus:outline-none"
const LABEL = "text-[12px] font-medium leading-4 text-v3-text-body"

const FORMATS = [
  { code: "BOOK_PDF", label: "ไฟล์ PDF", price: "฿1,890", physical: false, sub: "รับเป็นไฟล์ อ่านได้ทุกอุปกรณ์" },
  { code: "BOOK_PHYSICAL", label: "เล่มปกอ่อน A5 พิมพ์สี + PDF", price: "฿2,390", physical: true, sub: "จัดส่งถึงบ้าน + ได้ไฟล์ PDF ด้วย" },
] as const
const CHANNELS = ["Facebook", "Instagram", "Line"] as const

export function OrderBookScreen() {
  const router = useRouter()
  const [packageCode, setPackageCode] = useState<(typeof FORMATS)[number]["code"]>("BOOK_PDF")
  const [fullName, setFullName] = useState("")
  const [gender, setGender] = useState<"ชาย" | "หญิง" | "">("")
  const [birthDateBe, setBirthDateBe] = useState("")
  const [birthTime, setBirthTime] = useState("")
  const [shipName, setShipName] = useState("")
  const [shipPhone, setShipPhone] = useState("")
  const [shipAddress, setShipAddress] = useState("")
  const [contactChannel, setContactChannel] = useState<(typeof CHANNELS)[number] | "">("")
  const [contactAccount, setContactAccount] = useState("")
  const [email, setEmail] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmt = useMemo(() => FORMATS.find((f) => f.code === packageCode)!, [packageCode])
  const isPhysical = fmt.physical
  const canSubmit =
    !!fullName.trim() && !!gender && !!birthDateBe.trim() && !!birthTime.trim() &&
    !!contactChannel && !!contactAccount.trim() && confirmed &&
    (!isPhysical || (!!shipName.trim() && !!shipPhone.trim() && !!shipAddress.trim()))

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch("/api/v2/book-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageCode, fullName, gender, birthDateBe, birthTime,
          contactChannel, contactAccount, email: email || undefined,
          shipName: isPhysical ? shipName : undefined,
          shipPhone: isPhysical ? shipPhone : undefined,
          shipAddress: isPhysical ? shipAddress : undefined,
        }),
      })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string }
      if (!r.ok || !j.ok || !j.id) { setError(j.error ?? "บันทึกไม่สำเร็จ ลองใหม่"); return }
      try { sessionStorage.setItem(BOOK_ORDER_ID_KEY, j.id) } catch { /* ignore */ }
      void router.push(`/v2/shop/checkout?package_code=${encodeURIComponent(packageCode)}`)
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <SkyBackdrop />
      <Head><title>สั่งซื้อหนังสือ Your Life Code · MuMate</title></Head>
      <SkyHeader title="สั่งซื้อ Your Life Code" backHref="/v2/service/one-book" testId="order-book" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-40 pt-2">
        <p className="px-1 text-[12px] leading-5 text-v3-text-body">กรอกข้อมูลให้ครบและถูกต้อง (มีผลต่อความแม่นยำในการวิเคราะห์) แล้วชำระเงินเพื่อยืนยันคำสั่งซื้อ</p>

        {/* รูปแบบ */}
        <div className={CARD}>
          <span className={LABEL}>เลือกรูปแบบ *</span>
          <div className="flex flex-col gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.code}
                type="button"
                data-testid={`book-format-${f.code}`}
                onClick={() => setPackageCode(f.code)}
                className={`flex items-center gap-3 rounded-[14px] border p-3 text-left ${packageCode === f.code ? "border-v3-sapphire bg-v3-sapphire-tint" : "border-v3-border-input bg-white"}`}
              >
                <span className={`grid size-5 flex-none place-items-center rounded-full border-2 ${packageCode === f.code ? "border-v3-sapphire" : "border-v3-border-input"}`}>
                  {packageCode === f.code ? <span className="size-2.5 rounded-full bg-v3-sapphire" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-v3-navy">{f.label}</span>
                  <span className="block text-[11px] text-v3-text-body">{f.sub}</span>
                </span>
                <b className="flex-none text-[15px] text-v3-text-price">{f.price}</b>
              </button>
            ))}
          </div>
        </div>

        {/* ข้อมูลเจ้าของดวง */}
        <div className={CARD}>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>ชื่อ-นามสกุล *</span>
            <input className={INPUT} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อ นามสกุล" data-testid="book-fullname" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>เพศ *</span>
            <div className="flex gap-2">
              {(["ชาย", "หญิง"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGender(g)} data-testid={`book-gender-${g}`}
                  className={`h-[46px] flex-1 rounded-[14px] border text-[14px] font-bold ${gender === g ? "border-v3-sapphire bg-v3-sapphire-tint text-v3-navy" : "border-v3-border-input bg-white text-v3-text-body"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>วัน เดือน ปีเกิด (พ.ศ.) *</span>
            <input className={INPUT} value={birthDateBe} onChange={(e) => setBirthDateBe(e.target.value)} placeholder="เช่น 1 มกราคม พ.ศ. 2550" data-testid="book-birthdate" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>เวลาเกิด *</span>
            <input className={INPUT} value={birthTime} onChange={(e) => setBirthTime(e.target.value)} placeholder="เช่น 15.00 น." data-testid="book-birthtime" />
          </div>
        </div>

        {/* จัดส่ง (เฉพาะรูปเล่ม) */}
        {isPhysical ? (
          <div className={CARD} data-testid="book-ship">
            <span className={LABEL}>ข้อมูลจัดส่ง (รูปเล่ม) *</span>
            <input className={INPUT} value={shipName} onChange={(e) => setShipName(e.target.value)} placeholder="ชื่อผู้รับ" data-testid="book-shipname" />
            <input className={INPUT} value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="เบอร์ติดต่อ" inputMode="tel" data-testid="book-shipphone" />
            <textarea className={`${INPUT} h-[88px] py-3`} value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} placeholder="ที่อยู่สำหรับจัดส่ง" data-testid="book-shipaddress" />
          </div>
        ) : null}

        {/* ช่องทางติดต่อกลับ */}
        <div className={CARD}>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>ช่องทางติดต่อกลับ *</span>
            <select className={INPUT} value={contactChannel} onChange={(e) => setContactChannel(e.target.value as (typeof CHANNELS)[number])} data-testid="book-channel">
              <option value="">เลือก</option>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>ชื่อแอคเคาท์ สำหรับติดต่อกลับ *</span>
            <input className={INPUT} value={contactAccount} onChange={(e) => setContactAccount(e.target.value)} placeholder="เช่น @mumate" data-testid="book-account" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>อีเมล (ถ้ามี)</span>
            <input className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="อีเมลสำหรับรับไฟล์/ใบเสร็จ" inputMode="email" data-testid="book-email" />
          </div>
        </div>

        <label className="flex items-start gap-2 px-1 text-[12px] leading-5 text-v3-text-body">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 flex-none" data-testid="book-confirm" />
          <span>ยืนยันว่าข้อมูลถูกต้องครบถ้วน และเข้าใจว่าความแม่นยำของผลวิเคราะห์ขึ้นกับข้อมูลวันและเวลาเกิด</span>
        </label>

        {error ? <p className="px-1 text-[12px] font-bold text-v3-error" data-testid="book-error">{error}</p> : null}
      </div>

      {/* แถบชำระเงินล่าง */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center gap-3 border-t border-v3-border-card bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex-none">
          <p className="text-[11px] text-v3-text-muted">ยอดชำระ</p>
          <p className="text-[18px] font-black text-v3-text-price">{fmt.price}</p>
        </div>
        <KitButton onClick={() => void submit()} disabled={!canSubmit || submitting} testId="book-submit" className="flex-1">
          {submitting ? "กำลังไป…" : "ไปชำระเงิน"}
        </KitButton>
      </div>
    </div>
  )
}

export default OrderBookScreen

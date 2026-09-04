// features/v2-account/components/EditBirthScreen.tsx — /v2/settings/edit-birth (เฟรม edit-birth-data ×4)
// สถานะฟรี (banner เขียว) · ใช้สิทธิ์แล้ว (banner ชมพู + ราคา + ยอดคงเหลือหลังแก้) · ฟอร์ม · คำขอพิจารณา (ชีต).
// 🔴 โควตาตัดสินที่ engine เท่านั้น (GET quota + PATCH). PATCH แต้มไม่พอ → 409 → InsufficientQiSheet.
// หมายเหตุ: เฟรมมี "จังหวัดที่เกิด" + "ปลดล็อก" + correction ผ่าน LINE — backend ยังไม่รองรับจังหวัด/ลิงก์ LINE
//   → ทำตามโมเดลจริง (ฟอร์มวันเกิด/เวลา + คำขอพิจารณาในแอป), สไตล์ตามเฟรม.
import Head from "next/head"
import { useCallback, useEffect, useState } from "react"

import { KitButton, NoticeBanner, SheetShell, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { InsufficientQiSheet } from "@/features/v2-qi/components/QiSpendSheets"
import { ProfileGate } from "./ProfileGate"

const CARD = "v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5"
const INPUT = "h-12 rounded-[14px] border border-v3-border-input bg-white px-4 text-[14px] outline-none focus:border-v3-navy"

type ProfileResp = {
  profile?: { birthDate?: string | null; birthTime?: string | null; timeUnknown?: boolean | null; birthProvince?: string | null } | null
  quota?: { birthEditFreeUsed?: boolean; birthEditPriceQi?: number; pendingCorrection?: { reason: string } | null }
}

export function EditBirthScreen() {
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<"ok" | "not_authenticated" | "failed">("ok")
  const [quota, setQuota] = useState<ProfileResp["quota"] | null>(null)
  const [current, setCurrent] = useState<ProfileResp["profile"]>(null)
  const [walletQiNow, setWalletQiNow] = useState<number | null>(null)
  const [birth, setBirth] = useState("")
  const [birthTime, setBirthTime] = useState("")
  const [province, setProvince] = useState("")
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [insufficient, setInsufficient] = useState(false)
  const [walletQi, setWalletQi] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [reqMsg, setReqMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setKind("ok")
    try {
      const res = await fetch("/api/profile")
      if (res.status === 401) {
        setKind("not_authenticated")
        return
      }
      if (!res.ok) {
        setKind("failed")
        return
      }
      const j = (await res.json()) as ProfileResp
      setQuota(j.quota ?? null)
      setCurrent(j.profile ?? null)
      setBirth(j.profile?.birthDate ?? "")
      setBirthTime(j.profile?.birthTime ?? "")
      setProvince(j.profile?.birthProvince ?? "")
      setTimeUnknown(j.profile?.timeUnknown ?? false)
      // ยอด QI ปัจจุบัน สำหรับ preview "เหลือหลังแก้" (สถานะเสียเงิน) — best-effort
      if (j.quota?.birthEditFreeUsed) {
        fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).then((w) => setWalletQiNow(typeof w?.qi === "number" ? w.qi : null)).catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!birth) return
    setSaving(true)
    setMsg(null)
    setInsufficient(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birth, birthTime: timeUnknown ? null : birthTime || null, timeUnknown, birthProvince: province.trim() }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; birthEditMode?: string }
      if (res.ok) {
        setMsg(
          j.birthEditMode === "free"
            ? "บันทึกแล้ว — ใช้สิทธิ์แก้ฟรี 1 ครั้งของคุณ (ครั้งถัดไปมีค่าใช้จ่าย)"
            : `บันทึกแล้ว — หัก ${quota?.birthEditPriceQi ?? 100} QI ดวงของคุณจะอัปเดตตามวันเกิดใหม่`,
        )
        await load()
      } else if (res.status === 409) {
        const w = await fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).catch(() => null)
        setWalletQi(typeof w?.qi === "number" ? w.qi : 0)
        setInsufficient(true)
      } else {
        setMsg(String(j.error ?? "บันทึกไม่สำเร็จ"))
      }
    } finally {
      setSaving(false)
    }
  }

  const requestCorrection = async () => {
    if (!reason.trim()) return
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    setReqMsg(res.ok ? "ส่งคำขอแล้ว — ทีมจะติดต่อกลับ" : String(j.error ?? "ส่งไม่สำเร็จ"))
    if (res.ok) { setSheetOpen(false); setReason(""); await load() }
  }

  const priceQi = quota?.birthEditPriceQi ?? 100
  const freeUsed = quota?.birthEditFreeUsed === true

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>แก้วันเกิด · MuMate</title></Head>
      <SkyHeader title="ข้อมูลวันเกิดและธาตุ" backHref="/v2/account" testId="edit-birth" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === "ok" && (
          <>
            {quota?.pendingCorrection ? (
              <NoticeBanner tone="blue" testId="eb-pending" title="มีคำขอพิจารณารอทีมดูอยู่" sub={`“${quota.pendingCorrection.reason}”`} />
            ) : null}

            {/* สถานะโควตา — เขียว(ฟรี) / ชมพู(ใช้แล้ว) */}
            <NoticeBanner
              tone={freeUsed ? "pink" : "green"}
              testId="eb-quota"
              title={freeUsed ? "ใช้สิทธิ์แก้ฟรีไปแล้ว" : "แก้ได้ฟรีอีก 1 ครั้ง — ยังไม่ได้ใช้"}
              sub={freeUsed ? `ครั้งถัดไปใช้ ${priceQi} QI (ดวงเปลี่ยนทั้งหมดเมื่อวันเกิดเปลี่ยน)` : "สิทธิ์ฟรี 1 ครั้งตลอดชีพ — ครั้งถัดไปใช้ QI"}
              right={<span className="rounded-full bg-white/70 px-2 py-[2px] text-[11px] font-black">{freeUsed ? `${priceQi} QI` : "1/1"}</span>}
            />

            {/* ฟอร์ม */}
            <section className={CARD} data-testid="eb-form">
              {current?.birthDate ? (
                <p className="text-[11px] text-v3-text-muted" data-testid="eb-current">
                  ปัจจุบันในระบบ: {current.birthDate}{current.timeUnknown ? " (ไม่ทราบเวลาเกิด)" : current.birthTime ? ` ${current.birthTime}` : ""}
                </p>
              ) : null}
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">วันเกิด</span>
                <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} data-testid="eb-date" className={INPUT} />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} data-testid="eb-time-unknown" className="size-4" />
                <span className="text-[13px] text-v3-navy">ไม่ทราบเวลาเกิด</span>
              </label>
              {!timeUnknown && (
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-bold text-v3-navy">เวลาเกิด</span>
                  <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} data-testid="eb-time" className={INPUT} />
                </label>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">จังหวัดที่เกิด</span>
                <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="เช่น กรุงเทพมหานคร" data-testid="eb-province" className={INPUT} />
                <span className="text-[11px] leading-4 text-v3-text-muted">ใช้คำนวณเวลาสุริยคติให้แม่นขึ้น (แก้ได้อิสระ ไม่ใช้โควตา)</span>
              </label>
              {freeUsed && walletQiNow !== null && (
                <p className="rounded-[12px] bg-v3-ghost-white px-3 py-2 text-[12px] text-v3-navy">
                  ยอดของคุณ {walletQiNow.toLocaleString("th-TH")} QI · เหลือ {Math.max(0, walletQiNow - priceQi).toLocaleString("th-TH")} QI หลังแก้
                </p>
              )}
              {msg && <p data-testid="eb-msg" className="text-[12px] font-bold text-v3-sapphire">{msg}</p>}
              <KitButton onClick={() => void save()} disabled={saving || !birth} testId="eb-save">
                {saving ? "กำลังบันทึก..." : freeUsed ? `ยืนยันแก้ (ใช้ ${priceQi} QI)` : "ยืนยันแก้วันเกิด"}
              </KitButton>
            </section>

            {/* คำขอพิจารณา */}
            <section className={CARD} data-testid="eb-correction">
              <p className="text-[13px] font-bold text-v3-navy">กรอกผิดตั้งแต่แรก?</p>
              <p className="text-[12px] leading-4 text-v3-text-body">ถ้าระบบบันทึกวันเกิดไม่ตรง หรือมีเหตุพิเศษ ให้ทีมช่วยพิจารณาได้ (ไม่หัก QI)</p>
              <KitButton variant="outline" onClick={() => setSheetOpen(true)} testId="eb-correction-open">แจ้งแก้ข้อมูลไม่ถูกต้อง</KitButton>
              {reqMsg && <p data-testid="eb-correction-msg" className="text-[12px] font-bold text-v3-sapphire">{reqMsg}</p>}
            </section>
          </>
        )}
      </div>

      {/* ชีตคำขอพิจารณา */}
      {sheetOpen && (
        <SheetShell label="แจ้งแก้ข้อมูลไม่ถูกต้อง" onClose={() => setSheetOpen(false)}>
          <h2 className="text-[18px] font-bold text-v3-navy" data-testid="eb-correction-title">แจ้งแก้ข้อมูลไม่ถูกต้อง</h2>
          <p className="mt-1 text-[13px] leading-5 text-v3-text-body">เล่าเหตุผลของคุณ — ทีมจะตรวจสอบและติดต่อกลับ (ไม่หัก QI)</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น สมัครผิดวัน ขอแก้เป็นวันที่ถูกต้อง"
            data-testid="eb-correction-reason"
            rows={4}
            className="mt-3 w-full rounded-[16px] border border-v3-border-input bg-white p-4 text-[14px] outline-none placeholder:text-v3-placeholder"
          />
          <div className="mt-3">
            <KitButton onClick={() => void requestCorrection()} disabled={!reason.trim()} testId="eb-correction-send">ส่งคำขอ</KitButton>
          </div>
        </SheetShell>
      )}

      {insufficient && (
        <InsufficientQiSheet
          line={{ code: "birth_edit", qi: priceQi, grant: { type: "credit", kind: "card_use", credits: 0 }, title: "แก้วันเกิด (ครั้งถัดไป) ", note: "" }}
          balance={walletQi}
          onClose={() => setInsufficient(false)}
        />
      )}
    </div>
  )
}

export default EditBirthScreen

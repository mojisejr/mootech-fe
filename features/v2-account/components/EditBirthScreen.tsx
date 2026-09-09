// features/v2-account/components/EditBirthScreen.tsx — /v2/settings/edit-birth (เฟรม edit-birth-data ×4)
// A ฟรี (banner เขียว 1/1) · B ใช้สิทธิ์แล้ว (ช่องล็อก + "ปลดล็อก · N QI" + ยอดหลังแก้) · C กรอกผิดจริง (การ์ดฟ้า → ชีตแจ้งแก้).
// 🔴 โควตาตัดสินที่ engine เท่านั้น (GET quota + PATCH). PATCH แต้มไม่พอ → 409 → InsufficientQiSheet.
// หมายเหตุ: เฟรมมี "จังหวัดที่เกิด" + "ปลดล็อก" + correction ผ่าน LINE — backend ยังไม่รองรับจังหวัด/ลิงก์ LINE
//   → ทำตามโมเดลจริง (ฟอร์มวันเกิด/เวลา + คำขอพิจารณาในแอป), สไตล์ตามเฟรม.
import Head from "next/head"
import { useCallback, useEffect, useState } from "react"

import { KitButton, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { InsufficientQiSheet } from "@/features/v2-qi/components/QiSpendSheets"
import { TH_PROVINCES } from "@/lib/th/provinces"
import { thaiDateFull, thaiTimeLabel } from "@/lib/th/thai-date"
import { useCookies } from "react-cookie"
import { CookieKey } from "@/constants/cookie-key"
import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope"
import { clearDestinyCache } from "@/features/v2-destiny/destiny-cache"
import { ProfileGate } from "./ProfileGate"

// เฟรม form-card: ขาว + ขอบ border/default + r20 + p18 gap16 (ไม่มีเงา)
const CARD = "flex w-full flex-col gap-4 rounded-[20px] border border-v3-border-input bg-white p-[18px]"
// row แบบ picker: โชว์ค่าไทย + "⌄"; native input โปร่งใสทับไว้เพื่อเด้ง picker ของ OS
const PICKER_ROW = "flex h-[52px] w-full items-center gap-2 rounded-[14px] border border-v3-border-input bg-white px-4 text-[14px] leading-[22px]"
// input-locked (เฟรม 55399:5995): พื้น bg/subtle + ตัวหนังสือ muted + ป้าย "ล็อก"
const LOCKED_ROW = "flex h-[52px] w-full items-center gap-2 rounded-[14px] border border-v3-border-input bg-v3-rose-tint px-4 text-[14px] leading-[22px] text-v3-text-note"
const LABEL = "text-[12px] font-medium leading-4 text-v3-text-body"
const HINT = "text-[9px] leading-[13px] text-v3-text-note"

function ChevronDown() {
  return <span aria-hidden className="flex-none text-[14px] leading-none text-v3-text-note">⌄</span>
}

type ProfileResp = {
  profile?: { birthDate?: string | null; birthTime?: string | null; timeUnknown?: boolean | null; birthProvince?: string | null; gender?: string | null } | null
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
  const [gender, setGender] = useState<string>("") // เก็บ gender ปัจจุบันไว้ recompute chart (ไม่เปลี่ยนตอนแก้วันเกิด)
  // #Bug2 — หลังแก้วันเกิดต้อง recompute chart ฝั่ง FE user row ด้วย (มินต์ result_code ใหม่ → หน้าแรก self-heal)
  const [cookies] = useCookies([CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_IMAGE])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [insufficient, setInsufficient] = useState(false)
  const [walletQi, setWalletQi] = useState(0)
  // สถานะ B (เฟรม 55399:5976): ใช้สิทธิ์ฟรีแล้ว → ช่องล็อกจนกด "ปลดล็อกการแก้ไข · N QI" (UI-only; หัก QI จริงตอน PATCH เหมือนเดิม)
  const [unlocked, setUnlocked] = useState(false)

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
      setBirth((j.profile?.birthDate ?? "").slice(0, 10))
      setBirthTime(j.profile?.birthTime ?? "")
      setProvince(j.profile?.birthProvince ?? "")
      setTimeUnknown(j.profile?.timeUnknown ?? false)
      setGender(j.profile?.gender ?? "")
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
        // วันเกิดเปลี่ยน → ดวงต้องคำนวณใหม่: ล้าง client cache (server ก็ miss เองเพราะ birthKey เปลี่ยน)
        clearDestinyCache()
        // 🔴 #Bug2 — engine profile (birthDate) อัปเดตแล้ว แต่ "ธาตุ/หน้าแรก" คำนวณจาก FE user row (dob + result_code)
        // ผ่าน ChineseHoroscopeGet. ต้อง recompute chart ฝั่ง FE ด้วย (เหมือน register) ไม่งั้น result_code เดิม →
        // หน้าแรกโชว์ธาตุเก่า. best-effort (try/catch): ถ้าล้ม engine ก็บันทึกแล้ว — worst case = เท่าเดิม ไม่แย่ลง.
        // (ธาตุ = เสาวันเกิด ขึ้นกับ "วันเกิด" เท่านั้น — gender ที่ map เป็น binary ไม่กระทบธาตุ)
        try {
          const userId = (cookies[CookieKey.MEMBER_ID] as string) ?? ""
          if (userId) {
            const time = timeUnknown ? "" : birthTime || ""
            const g = gender === "FEMALE" ? "FEMALE" : "MALE"
            const name = (cookies[CookieKey.MEMBER_NAME] as string) ?? ""
            await ChineseHoroscopeCalculate(userId, name, birth, time, g, cookies[CookieKey.MEMBER_IMAGE] ?? "", "", name, "")
          }
        } catch { /* recompute ล้ม → ธาตุจะอัปเดตช้า แต่วันเกิดใน engine บันทึกแล้ว */ }
        setMsg(
          j.birthEditMode === "free"
            ? "บันทึกแล้ว — ใช้สิทธิ์แก้ฟรี 1 ครั้งของคุณ (ครั้งถัดไปมีค่าใช้จ่าย)"
            : `บันทึกแล้ว — หัก ${quota?.birthEditPriceQi ?? 150} QI ดวงของคุณจะอัปเดตตามวันเกิดใหม่`,
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

  const priceQi = quota?.birthEditPriceQi ?? 150
  const freeUsed = quota?.birthEditFreeUsed === true
  // dirty-gate: ปุ่มบันทึกใช้ได้เมื่อมีการแก้ไขจากค่าปัจจุบันในระบบ (ตาม Figma)
  const dirty =
    birth !== ((current?.birthDate ?? "").slice(0, 10)) ||
    birthTime !== (current?.birthTime ?? "") ||
    timeUnknown !== (current?.timeUnknown ?? false) ||
    province !== (current?.birthProvince ?? "")

  const locked = freeUsed && !unlocked

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>แก้วันเกิด · MuMate</title></Head>
      <SkyHeader title="ข้อมูลวันเกิดและธาตุ" backHref="/v2/account" testId="edit-birth" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-6 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === "ok" && (
          <>
            {/* สถานะโควตา — A ฟรี (เฟรม state-free-quota 55399:5947) / B ใช้แล้ว (state-quota-used 55399:5989) */}
            {freeUsed ? (
              <div className="flex w-full flex-col gap-[3px] rounded-[18px] border border-v3-border-input bg-v3-rose-tint px-4 py-3.5" data-testid="eb-quota">
                <p className="text-[14px] font-medium leading-5 text-v3-navy">ใช้สิทธิ์แก้ฟรีไปแล้ว</p>
                <p className="text-[12px] leading-[18px] text-v3-text-body">เปลี่ยนวันเกิดอีกครั้งใช้ {priceQi} QI เพราะระบบต้องคำนวณดวงใหม่ทั้งหมด</p>
              </div>
            ) : (
              <div className="flex w-full items-center gap-2.5 rounded-[18px] border border-[#C8E8A8] bg-v3-qi-earn-bg px-[18px] py-4 text-v3-qi-earn" data-testid="eb-quota">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[14px] font-medium leading-5">แก้ได้ฟรีอีก 1 ครั้ง</p>
                  <p className="text-[12px] leading-[18px] opacity-85">ใช้สำหรับกรณีกรอกผิด หลังจากนั้นการเปลี่ยนวันเกิดจะมีค่าใช้จ่าย</p>
                </div>
                <span className="flex-none rounded-full bg-white px-2.5 py-[5px] text-[9px] font-bold leading-none">1 / 1</span>
              </div>
            )}

            {/* ฟอร์ม (เฟรม form-card) — ล็อกเมื่อใช้สิทธิ์ฟรีแล้วและยังไม่ปลดล็อก */}
            <section className={CARD} data-testid="eb-form">
              {/* วันเกิด — row ไทย + native date picker ทับ */}
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>วันเกิด</span>
                {locked ? (
                  <span className={LOCKED_ROW} data-testid="eb-date-locked"><span className="min-w-0 flex-1">{birth ? thaiDateFull(birth) : "—"}</span><span className="flex-none">ล็อก</span></span>
                ) : (
                  <span className="relative block">
                    <span className={PICKER_ROW}>
                      <span className={"min-w-0 flex-1 " + (birth ? "text-v3-navy" : "text-v3-placeholder")}>{birth ? thaiDateFull(birth) : "เลือกวันเกิด"}</span>
                      <ChevronDown />
                    </span>
                    <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} data-testid="eb-date" aria-label="วันเกิด" className="absolute inset-0 size-full cursor-pointer opacity-0" />
                  </span>
                )}
              </label>

              {/* เวลาเกิด — row ไทย + native time picker ทับ (หรือ "ไม่ทราบเวลา") */}
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>เวลาเกิด</span>
                {locked ? (
                  <span className={LOCKED_ROW}><span className="min-w-0 flex-1">{timeUnknown ? "ไม่ทราบเวลา" : birthTime ? thaiTimeLabel(birthTime) : "—"}</span><span className="flex-none">ล็อก</span></span>
                ) : timeUnknown ? (
                  <span className={PICKER_ROW + " text-v3-text-note"}>ไม่ทราบเวลา</span>
                ) : (
                  <span className="relative block">
                    <span className={PICKER_ROW}>
                      <span className={"min-w-0 flex-1 " + (birthTime ? "text-v3-navy" : "text-v3-placeholder")}>{birthTime ? thaiTimeLabel(birthTime) : "เลือกเวลาเกิด"}</span>
                      <ChevronDown />
                    </span>
                    <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} data-testid="eb-time" aria-label="เวลาเกิด" className="absolute inset-0 size-full cursor-pointer opacity-0" />
                  </span>
                )}
                {!locked && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} data-testid="eb-time-unknown" className="size-4 accent-v3-sapphire" />
                    <span className="text-[12px] leading-4 text-v3-text-body">ไม่ทราบเวลา</span>
                  </label>
                )}
                <span className={HINT}>ถ้าไม่ทราบเวลาแน่ชัด เลือก &quot;ไม่ทราบเวลา&quot; ได้ ระบบจะคำนวณแบบหยาบ</span>
              </label>

              {/* จังหวัดที่เกิด — dropdown 77 จังหวัด */}
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>จังหวัดที่เกิด</span>
                {locked ? (
                  <span className={LOCKED_ROW}><span className="min-w-0 flex-1">{province || "—"}</span><span className="flex-none">ล็อก</span></span>
                ) : (
                  <span className="relative block">
                    <select value={province} onChange={(e) => setProvince(e.target.value)} data-testid="eb-province" className={PICKER_ROW + " w-full appearance-none pr-10 outline-none focus:border-v3-navy " + (province ? "text-v3-navy" : "text-v3-placeholder")}>
                      <option value="">เลือกจังหวัด</option>
                      {TH_PROVINCES.map((p) => (
                        <option key={p} value={p} className="text-v3-navy">{p}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center"><ChevronDown /></span>
                  </span>
                )}
                <span className={HINT}>ใช้คำนวณเวลาสุริยคติให้แม่นขึ้น</span>
              </label>
              {msg && <p data-testid="eb-msg" className="text-[12px] font-bold text-v3-sapphire">{msg}</p>}
            </section>

            {/* sticky-footer — A/ฟรี: บันทึก (ดับจนแก้) · B/ล็อก: ปลดล็อก · N QI + ยอดหลังแก้ */}
            <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-white via-white/95 to-white/0 px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3.5">
              {locked ? (
                <>
                  <KitButton onClick={() => setUnlocked(true)} testId="eb-unlock">ปลดล็อกการแก้ไข · {priceQi} QI</KitButton>
                  {walletQiNow !== null && (
                    <p className="text-center text-[9px] leading-[13px] text-v3-text-note" data-testid="eb-after">
                      ยอดของคุณ {walletQiNow.toLocaleString("th-TH")} QI · เหลือ {Math.max(0, walletQiNow - priceQi).toLocaleString("th-TH")} QI หลังแก้
                    </p>
                  )}
                </>
              ) : (
                <>
                  <KitButton onClick={() => void save()} disabled={saving || !birth || !dirty} testId="eb-save" className={!dirty ? "!bg-v3-rose-tint !text-v3-text-note !opacity-100" : ""}>
                    {saving ? "กำลังบันทึก..." : freeUsed ? `บันทึกการเปลี่ยนแปลง (ใช้ ${priceQi} QI)` : "บันทึกการเปลี่ยนแปลง"}
                  </KitButton>
                  {freeUsed && walletQiNow !== null ? (
                    <p className="text-center text-[9px] leading-[13px] text-v3-text-note" data-testid="eb-after">
                      ยอดของคุณ {walletQiNow.toLocaleString("th-TH")} QI · เหลือ {Math.max(0, walletQiNow - priceQi).toLocaleString("th-TH")} QI หลังแก้
                    </p>
                  ) : (
                    <p className="text-center text-[9px] leading-[13px] text-v3-text-note">ปุ่มจะใช้งานได้เมื่อมีการแก้ไข</p>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

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

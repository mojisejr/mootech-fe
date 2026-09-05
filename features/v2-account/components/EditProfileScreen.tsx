// features/v2-account/components/EditProfileScreen.tsx — /v2/settings/edit-profile (เฟรม `edit-personal-info`)
// avatar + ชื่อจริง/นามสกุล/เพศ + @name (อ่านอย่างเดียว) + การ์ดวันเกิดล็อก (แก้หน้าอื่น).
// ⚠️ โมเดลจริงของ engine = firstName/lastName/gender + displayName(อ่านอย่างเดียว) — ไม่มี email/อัปโหลดรูป
// (เฟรมมีช่องอีเมล/แก้ @name แต่ backend ยังไม่รองรับ → ทำตามโมเดลจริง, สไตล์ตามเฟรม). วันเกิดแยกโควตาที่ /edit-birth.
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { KitButton, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { ProfileGate } from "./ProfileGate"

const CARD = "v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5"
const INPUT = "h-12 rounded-[14px] border border-v3-border-input bg-white px-4 text-[14px] outline-none focus:border-v3-navy placeholder:text-v3-placeholder"

type Profile = {
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  gender?: string | null
  email?: string | null
  birthDate?: string | null
  birthTime?: string | null
  timeUnknown?: boolean | null
}

const GENDERS: Array<{ code: string; label: string }> = [
  { code: "MALE", label: "ชาย" },
  { code: "FEMALE", label: "หญิง" },
  { code: "OTHER", label: "อื่น ๆ" },
]

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

/** "1984-01-15" → "15 ม.ค. 2527" (พ.ศ.) ; คืน ISO เดิมถ้า parse ไม่ได้ */
function thaiBirthLabel(birthDate?: string | null, birthTime?: string | null, timeUnknown?: boolean | null): string {
  if (!birthDate) return "ยังไม่ได้ระบุ"
  const [y, m, d] = birthDate.slice(0, 10).split("-").map(Number)
  const dateTh = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) && m >= 1 && m <= 12
    ? `${d} ${TH_MONTHS[m - 1]} ${y + 543}`
    : birthDate
  const timeTh = timeUnknown ? " (ไม่ทราบเวลา)" : birthTime ? `, ${birthTime} น.` : ""
  return `${dateTh}${timeTh}`
}

export function EditProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<"ok" | "not_authenticated" | "failed">("ok")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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
      const j = (await res.json()) as { profile?: Profile | null }
      setProfile(j.profile ?? null)
      setFirstName(j.profile?.firstName ?? "")
      setLastName(j.profile?.lastName ?? "")
      setGender(j.profile?.gender ?? null)
      setEmail(j.profile?.email ?? "")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), gender, email: email.trim() }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setMsg(res.ok ? "บันทึกแล้ว" : String(j.error ?? "บันทึกไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>แก้ไขข้อมูลส่วนตัว · MuMate</title></Head>
      <SkyHeader title="แก้ไขข้อมูลส่วนตัว" backHref="/v2/account" testId="edit-profile" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === "ok" && (
          <>
            {/* avatar (ตัวย่อชื่อ — ยังไม่รองรับอัปโหลดรูปเอง) */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <span aria-hidden className="grid size-20 place-items-center rounded-full bg-v3-ghost-white text-[30px] font-black text-v3-navy shadow-[0_2px_10px_rgba(26,38,77,.15)]">
                {profile?.firstName?.[0] || profile?.displayName?.[0] || "มู"}
              </span>
              {profile?.displayName ? <p className="text-[13px] font-bold text-v3-navy" data-testid="ep-display-name">@{profile.displayName}</p> : null}
              <p className="text-[11px] text-v3-text-muted">รูปโปรไฟล์ตามธาตุประจำตัว</p>
            </div>

            <section className={CARD} data-testid="ep-form">
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">ชื่อจริง</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="เช่น สมชาย" data-testid="ep-first-name" className={INPUT} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">นามสกุล</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="เช่น ใจดี" data-testid="ep-last-name" className={INPUT} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">เพศ</span>
                <span className="relative block">
                  <select
                    value={gender ?? ""}
                    onChange={(e) => setGender(e.target.value || null)}
                    data-testid="ep-gender"
                    className={INPUT + " w-full appearance-none pr-10 " + (gender ? "text-v3-navy" : "text-v3-placeholder")}
                  >
                    <option value="">เลือกเพศ</option>
                    {GENDERS.map((g) => (
                      <option key={g.code} value={g.code} className="text-v3-navy">{g.label}</option>
                    ))}
                  </select>
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute inset-y-0 right-4 my-auto text-v3-text-muted"><path d="m6 9 6 6 6-6" /></svg>
                </span>
                <span className="text-[11px] leading-4 text-v3-text-muted">ใช้ประกอบคำทำนาย</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">อีเมล</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="เช่น you@example.com" data-testid="ep-email" className={INPUT} />
                <span className="text-[11px] leading-4 text-v3-text-muted">ใช้ส่งใบเสร็จและไฟล์ข้อมูลของคุณ</span>
              </label>
              {msg && <p data-testid="ep-msg" className="text-[12px] font-bold text-v3-sapphire">{msg}</p>}
              <KitButton onClick={() => void save()} disabled={saving} testId="ep-save">{saving ? "กำลังบันทึก..." : "บันทึก"}</KitButton>
            </section>

            {/* วันเกิด — ล็อก (แก้หน้าอื่น มีโควตา) */}
            <section className="rounded-[24px] bg-[#FCE4EC] p-4" data-testid="ep-birth-link">
              <Link href="/v2/settings/edit-birth" data-testid="ep-to-birth" className="flex items-center justify-between gap-2">
                <span>
                  <span className="block text-[13px] font-bold text-v3-navy">วันเกิดและเวลาเกิด</span>
                  <span className="block text-[12px] leading-4 text-v3-text-body">
                    {thaiBirthLabel(profile?.birthDate, profile?.birthTime, profile?.timeUnknown)}
                  </span>
                </span>
                <span className="flex-none text-[12px] font-bold text-v3-pumpkin">แก้ในหน้าอื่น ›</span>
              </Link>
              <p className="mt-2 text-[11px] leading-4 text-v3-text-muted">แยกไปอีกหน้าเพราะแก้กระทบคำทำนายทั้งแอป (มีโควตา)</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default EditProfileScreen

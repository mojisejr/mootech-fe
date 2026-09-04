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
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">เพศ</span>
                <div className="flex gap-2" data-testid="ep-genders">
                  {GENDERS.map((g) => (
                    <button
                      key={g.code}
                      onClick={() => setGender(gender === g.code ? null : g.code)}
                      data-testid={`ep-gender-${g.code}`}
                      className={(gender === g.code ? "bg-v3-navy text-white" : "border border-v3-border-card text-v3-navy") + " h-11 flex-1 rounded-[14px] text-[13px] font-bold"}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
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
                    {profile?.birthDate ? `${profile.birthDate}${profile.birthTime ? `, ${profile.birthTime} น.` : ""}${profile.timeUnknown ? " (ไม่ทราบเวลา)" : ""}` : "ยังไม่ได้ระบุ"}
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

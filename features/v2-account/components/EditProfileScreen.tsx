// features/v2-account/components/EditProfileScreen.tsx — /v2/settings/edit-profile (เฟรม `edit-personal-info`)
// avatar + ชื่อจริง/นามสกุล/เพศ + @name (อ่านอย่างเดียว) + การ์ดวันเกิดล็อก (แก้หน้าอื่น).
// ⚠️ โมเดลจริงของ engine = firstName/lastName/gender + displayName(อ่านอย่างเดียว) — ไม่มี email/อัปโหลดรูป
// (เฟรมมีช่องอีเมล/แก้ @name แต่ backend ยังไม่รองรับ → ทำตามโมเดลจริง, สไตล์ตามเฟรม). วันเกิดแยกโควตาที่ /edit-birth.
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

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
  hasAvatar?: boolean | null
  avatarUpdatedAt?: string | null
}

// @name (ชื่อที่แสดง) — ไทย/อังกฤษ/ตัวเลข/_/. ยาว 4-24 (ตรงกับ engine display-name)
const DISPLAY_NAME_RE = /^[0-9A-Za-z_฀-๿.]{4,24}$/

/** อ่านไฟล์รูปเป็น data URL (base64) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ""))
    r.onerror = () => reject(new Error("read failed"))
    r.readAsDataURL(file)
  })
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
  // @name (แก้ได้) + สถานะเช็คชื่อซ้ำ
  const [handle, setHandle] = useState("")
  const [handleErr, setHandleErr] = useState<string | null>(null)
  // avatar
  const [hasAvatar, setHasAvatar] = useState(false)
  const [avatarTs, setAvatarTs] = useState<string>("")
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      setHandle(j.profile?.displayName ?? "")
      setHandleErr(null)
      setHasAvatar(!!j.profile?.hasAvatar)
      setAvatarTs(j.profile?.avatarUpdatedAt ?? "")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    setHandleErr(null)
    try {
      // 1) @name — ถ้าเปลี่ยน ต้องผ่านก่อน (ตรวจรูปแบบ + ชื่อซ้ำที่ engine)
      const nextHandle = handle.trim()
      if (nextHandle && nextHandle !== (profile?.displayName ?? "")) {
        if (!DISPLAY_NAME_RE.test(nextHandle)) {
          setHandleErr("ใช้ไทย/อังกฤษ/ตัวเลข/_/. ยาว 4-24 ตัวอักษร")
          return
        }
        const dnRes = await fetch("/api/v2/display-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: nextHandle }),
        })
        if (!dnRes.ok) {
          const dj = (await dnRes.json().catch(() => ({}))) as { error?: string }
          setHandleErr(dj.error === "display_name_taken" ? "ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น" : "ตั้งชื่อไม่สำเร็จ")
          return
        }
      }
      // 2) ข้อมูลอื่น ๆ
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), gender, email: email.trim() }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.ok) {
        setMsg("บันทึกแล้ว")
        await load()
      } else {
        setMsg(String(j.error ?? "บันทึกไม่สำเร็จ"))
      }
    } finally {
      setSaving(false)
    }
  }

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // ให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    setAvatarBusy(true)
    setMsg(null)
    try {
      const dataUrl = await fileToBase64(file)
      const res = await fetch("/api/v2/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl, mime: file.type }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; avatarUpdatedAt?: string }
      if (res.ok) {
        setHasAvatar(true)
        setAvatarTs(j.avatarUpdatedAt ?? String(Date.now())) // cache-bust
      } else {
        setMsg(String(j.error ?? "อัปโหลดรูปไม่สำเร็จ"))
      }
    } catch {
      setMsg("อ่านไฟล์รูปไม่สำเร็จ")
    } finally {
      setAvatarBusy(false)
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
            {/* avatar — อัปโหลดรูปเองได้ (fallback = ตัวย่อชื่อตามธาตุ) */}
            <div className="flex flex-col items-center gap-1 pt-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                data-testid="ep-avatar-btn"
                className="relative grid size-20 place-items-center overflow-hidden rounded-full bg-v3-ghost-white text-[30px] font-black text-v3-navy shadow-[0_2px_10px_rgba(26,38,77,.15)]"
                aria-label="เปลี่ยนรูปโปรไฟล์"
              >
                {hasAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/v2/avatar?t=${encodeURIComponent(avatarTs)}`} alt="รูปโปรไฟล์" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span>{profile?.firstName?.[0] || profile?.displayName?.[0] || "มู"}</span>
                )}
                {avatarBusy ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/40 text-[11px] font-bold text-white">กำลังอัป…</span>
                ) : (
                  <span aria-hidden className="absolute bottom-0 right-0 grid size-6 place-items-center rounded-full border-2 border-white bg-v3-cyan text-white">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden data-testid="ep-avatar-input" onChange={onPickAvatar} />
              <button type="button" onClick={() => fileRef.current?.click()} className="text-[13px] font-bold text-v3-cyan" data-testid="ep-avatar-change">เปลี่ยนรูปโปรไฟล์</button>
              <p className="text-[11px] text-v3-text-muted">อัปโหลดได้เอง หรือใช้ตัวย่อชื่อตามธาตุ</p>
            </div>

            <section className={CARD} data-testid="ep-form">
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">ชื่อที่แสดง (@name)</span>
                <span className="relative block">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[14px] text-v3-text-muted">@</span>
                  <input
                    value={handle}
                    onChange={(e) => { setHandle(e.target.value.trim()); setHandleErr(null) }}
                    placeholder="เช่น mumate_fan"
                    data-testid="ep-handle"
                    className={INPUT + " w-full pl-8"}
                  />
                </span>
                {handleErr
                  ? <span className="text-[11px] leading-4 text-v3-error" data-testid="ep-handle-err">{handleErr}</span>
                  : <span className="text-[11px] leading-4 text-v3-text-muted">ใช้แสดงในแอปและตอนถามเพื่อน · ตั้งไม่ซ้ำกับคนอื่น (ไทย/อังกฤษ/ตัวเลข/_/. 4-24)</span>}
              </label>
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

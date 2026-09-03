// features/v2-account/components/EditProfileScreen.tsx — /v2/settings/edit-profile
// เฟรม `edit-personal-info`: ชื่อจริง/นามสกุล/เพศ + @name (โชว์ + ทางไปตั้ง) — วันเกิดแยกหน้า
// (เฟรม edit-birth-data มีโควตาของตัวเอง). ข้อมูลจริงจาก engine /api/profile ผ่าน BFF.
import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { AppHeader } from "@/features/v2-shell/components/AppHeader"
import { useV2Tier } from "@/features/auth/hooks/useV2Tier"
import { ProfileGate } from "./ProfileGate"

const CARD = "flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

type Profile = {
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  gender?: string | null
  birthDate?: string | null
  timeUnknown?: boolean | null
}

export function EditProfileScreen() {
  const tier = useV2Tier(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<"ok" | "not_authenticated" | "failed">("ok")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState<string | null>(null)
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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), gender }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setMsg(res.ok ? "บันทึกแล้ว" : String(j.error ?? "บันทึกไม่สำเร็จ"))
    } finally {
      setSaving(false)
    }
  }

  const GENDERS: Array<{ code: string; label: string }> = [
    { code: "MALE", label: "ชาย" },
    { code: "FEMALE", label: "หญิง" },
    { code: "OTHER", label: "อื่น ๆ" },
  ]

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>แก้ไขข้อมูลส่วนตัว · MuMate</title></Head>
      <AppHeader testId="edit-profile-header" title="แก้ไขข้อมูลส่วนตัว" backHref="/v2/account" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === "ok" && (
          <>
            {profile?.displayName ? (
              <section className={CARD} data-testid="ep-display-name">
                <p className="text-[12px] leading-4 text-v3-text-muted">ชื่อแสดง (@name)</p>
                <p className="text-[15px] font-black text-v3-navy">@{profile.displayName}</p>
                <p className="text-[11px] leading-4 text-v3-text-muted">เปลี่ยนได้ที่หน้าสมัคร — ชื่อนี้โชว์ในระบบเพื่อน/ดวงสมพงษ์</p>
              </section>
            ) : null}

            <section className={CARD} data-testid="ep-form">
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">ชื่อจริง</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="เช่น สมชาย"
                  data-testid="ep-first-name"
                  className="h-11 rounded-full border border-v3-border-input bg-white px-4 text-[14px] outline-none placeholder:text-v3-placeholder"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">นามสกุล</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="เช่น ใจดี"
                  data-testid="ep-last-name"
                  className="h-11 rounded-full border border-v3-border-input bg-white px-4 text-[14px] outline-none placeholder:text-v3-placeholder"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">เพศ</span>
                <div className="flex gap-2" data-testid="ep-genders">
                  {GENDERS.map((g) => (
                    <button
                      key={g.code}
                      onClick={() => setGender(gender === g.code ? null : g.code)}
                      data-testid={`ep-gender-${g.code}`}
                      className={
                        (gender === g.code ? "bg-v3-cyan text-white" : "border border-v3-border-card text-v3-navy") +
                        " h-10 flex-1 rounded-full text-[13px] font-bold"
                      }
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              {msg && (
                <p data-testid="ep-msg" className="text-[12px] font-bold text-v3-sapphire">{msg}</p>
              )}
              <button
                onClick={() => void save()}
                disabled={saving}
                data-testid="ep-save"
                className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white disabled:opacity-40"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </section>

            <section className={CARD} data-testid="ep-birth-link">
              <Link href="/v2/settings/edit-birth" data-testid="ep-to-birth" className="flex items-center justify-between gap-2">
                <span>
                  <span className="block text-sm font-bold text-v3-navy">วันเกิดของคุณ</span>
                  <span className="block text-[12px] leading-4 text-v3-text-body">
                    {profile?.birthDate ? `${profile.birthDate}${profile.timeUnknown ? " (ไม่ทราบเวลาเกิด)" : ""}` : "ยังไม่ได้ระบุในระบบใหม่"}
                  </span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="flex-none text-v3-text-muted">
                  <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default EditProfileScreen

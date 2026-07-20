// MuMate v2 — /v2/register profile-setup (Slice 1). Team-gated (SSR). Client identity routing via
// useCurrentUser (cookie-truth): anon → bounce to /v2 (never bounce on 'loading' — that's the
// self-heal minting MEMBER_ID; bouncing there is the login-loop), authed → show the form. REUSES
// BirthDayInput + the profile-save endpoint via useV2ProfileForm (no rewrite). Fields are supplied
// as children into Lamun's RegisterView shell (header + AvatarUpload + SafetyBlock + submit).
import type { GetServerSideProps } from 'next'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import BirthDayInput from '@/components/birthday-input'
import { RegisterView } from '@/features/auth/components/RegisterView'
import { useV2ProfileForm } from '@/features/auth/hooks/useV2ProfileForm'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req) // team preview gate
  if (redirect) return redirect
  return { props: {} }
}

export default function V2RegisterPage() {
  const router = useRouter()
  const { status } = useCurrentUser()
  // Slice 1 endpoint: after save → /v2 home (slice 2 wires the destiny result). code is available
  // if a later slice wants /my-destiny/:code.
  const form = useV2ProfileForm(() => router.replace('/v2'))

  // anon → bounce to /v2. NEVER bounce on 'loading' (self-heal minting MEMBER_ID in flight).
  useEffect(() => {
    if (status === 'anon') router.replace('/v2')
  }, [status, router])

  if (status !== 'authed') return <AuthLoadingGate />

  const f = form.fields
  return (
    <RegisterView onSubmit={form.onSubmit} submitting={form.submitting} canSubmit={form.canSubmit}>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        ชื่อ
        <input
          value={f.name}
          onChange={(e) => f.setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base"
          placeholder="ชื่อของคุณ"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        นามสกุล (ไม่บังคับ)
        <input
          value={f.surname}
          onChange={(e) => f.setSurname(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-base"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm text-neutral-700">
        เพศ
        <div className="flex gap-3">
          {(['MALE', 'FEMALE'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => f.setGender(g)}
              className={`flex-1 rounded-lg border py-2 ${
                f.gender === g ? 'border-v3-sapphire bg-v3-sapphire/10 text-v3-sapphire' : 'border-neutral-300'
              }`}
            >
              {g === 'MALE' ? 'ชาย' : 'หญิง'}
            </button>
          ))}
        </div>
      </div>

      {/* Reused date picker */}
      <BirthDayInput dob={f.birthDay} onChangeDate={f.setBirthDay} />

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={f.isRememberTimeBirth}
          onChange={(e) => f.setIsRememberTimeBirth(e.target.checked)}
        />
        ทราบเวลาเกิด
      </label>

      {f.isRememberTimeBirth ? (
        <div className="flex gap-2">
          <input
            value={f.timeHourBirth}
            onChange={(e) => f.setTimeHourBirth(e.target.value)}
            inputMode="numeric"
            placeholder="ชม."
            className="w-20 rounded-lg border border-neutral-300 px-3 py-2 text-base"
          />
          <input
            value={f.timeMinuteBirth}
            onChange={(e) => f.setTimeMinuteBirth(e.target.value)}
            inputMode="numeric"
            placeholder="นาที"
            className="w-20 rounded-lg border border-neutral-300 px-3 py-2 text-base"
          />
        </div>
      ) : null}

      {!form.isTimeValid ? (
        <p className="text-sm text-red-600">เวลาเกิดไม่ถูกต้อง (ชั่วโมง 0–23, นาที 0–59)</p>
      ) : null}
      {form.error ? <p className="text-sm text-red-600">{form.error}</p> : null}
    </RegisterView>
  )
}

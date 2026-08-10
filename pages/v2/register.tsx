// MuMate v2 — /v2/register profile-setup (Slice 1). Team-gated (SSR). Client identity + hydration
// via useV2AuthGate (mount-safe: no SSR mismatch; anon → /v2; loop invariant preserved).
//
// Ownership (codify): goo's useV2ProfileForm holds ALL logic (state/validation/save + BirthDayInput
// reuse); THIS page composes the fields with the design-system primitives (Field / PillTabs /
// Checkbox) into Lamun's RegisterView shell — styled composition is the designer's lane.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import BirthDayInput from '@/components/birthday-input'
import { RegisterView } from '@/features/auth/components/RegisterView'
import { useV2ProfileForm } from '@/features/auth/hooks/useV2ProfileForm'
import { Field } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { PillTabs } from '@/components/ui/pill-tabs'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req) // team preview gate
  if (redirect) return redirect
  return { props: {} }
}

export default function V2RegisterPage() {
  const router = useRouter()
  const { status, showLoading } = useV2AuthGate({ redirectWhenAnon: '/v2' })
  // Slice 1 endpoint: after save → /v2 home (slice 2 wires the destiny result).
  const form = useV2ProfileForm(() => router.replace('/v2'))

  if (showLoading || status !== 'authed') return <AuthLoadingGate />

  const f = form.fields
  const timeError = !form.isTimeValid

  return (
    <RegisterView onSubmit={form.onSubmit} submitting={form.submitting} canSubmit={form.canSubmit}>
      <Field
        label="ชื่อ"
        placeholder="ใส่ชื่อของคุณ"
        value={f.name}
        onChange={(e) => f.setName(e.target.value)}
      />
      <Field
        label="นามสกุล (ไม่บังคับ)"
        placeholder="นามสกุล"
        value={f.surname}
        onChange={(e) => f.setSurname(e.target.value)}
      />

      <div className="flex flex-col gap-2">
        <span className="font-ibm text-sm font-semibold leading-5 text-v3-text-body-alt">เพศ</span>
        <PillTabs
          ariaLabel="เพศ"
          items={[
            { label: 'ชาย', value: 'MALE' },
            { label: 'หญิง', value: 'FEMALE' },
          ]}
          value={f.gender ?? ''}
          onChange={(v) => f.setGender(v as 'MALE' | 'FEMALE')}
        />
      </div>

      {/* reused legacy date picker (logic owned by BirthDayInput; styling is a follow-up) */}
      <div className="flex flex-col gap-2">
        <span className="font-ibm text-sm font-semibold leading-5 text-v3-text-body-alt">
          วันเดือนปีเกิด
        </span>
        <BirthDayInput dob={f.birthDay} onChangeDate={f.setBirthDay} />
      </div>

      <Checkbox
        checked={f.isRememberTimeBirth}
        onChange={f.setIsRememberTimeBirth}
        label="ทราบเวลาเกิด"
      />

      {f.isRememberTimeBirth ? (
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="ชั่วโมง"
            placeholder="ชม. (0–23)"
            inputMode="numeric"
            value={f.timeHourBirth}
            error={timeError}
            onChange={(e) => f.setTimeHourBirth(e.target.value)}
          />
          <Field
            label="นาที"
            placeholder="นาที (0–59)"
            inputMode="numeric"
            value={f.timeMinuteBirth}
            error={timeError}
            onChange={(e) => f.setTimeMinuteBirth(e.target.value)}
          />
        </div>
      ) : null}

      {timeError ? (
        <p className="font-ibm text-xs leading-[18px] text-v3-error">
          เวลาเกิดไม่ถูกต้อง (ชั่วโมง 0–23, นาที 0–59)
        </p>
      ) : null}
      {form.error ? (
        <p className="font-ibm text-xs leading-[18px] text-v3-error">{form.error}</p>
      ) : null}
    </RegisterView>
  )
}

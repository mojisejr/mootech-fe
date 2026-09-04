// MuMate v2 — /v2/register profile-setup (Slice 1). Team-gated (SSR). Client identity + hydration
// via useV2AuthGate (mount-safe: no SSR mismatch; anon → /v2; loop invariant preserved).
//
// Ownership (codify): goo's useV2ProfileForm holds ALL logic (state/validation/save + BirthDayInput
// reuse); THIS page composes the fields with the design-system primitives (Field / PillTabs /
// Checkbox) into Lamun's RegisterView shell — styled composition is the designer's lane.
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate'
import { AuthLoadingGate } from '@/features/v2-shell/components/AuthLoadingGate'
import ScreenIdentityStuck from '@/components/screen-identity-stuck'
import BirthDayInput from '@/components/birthday-input'
import { RegisterView } from '@/features/auth/components/RegisterView'
import { useV2ProfileForm } from '@/features/auth/hooks/useV2ProfileForm'
import { useReferralApply } from '@/features/auth/hooks/use-referral-apply'
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
  const { status, showLoading, identityStuck } = useV2AuthGate({ redirectWhenAnon: '/v2' })
  // Slice 1 endpoint: after save → /v2 home (slice 2 wires the destiny result).
  const form = useV2ProfileForm(() => router.replace('/v2'))

  // team.mp4 — หน้าสมัครเพิ่มช่อง "โค้ดผู้แนะนำ" (ไม่บังคับ): deep link /invite/MUMATE123 เก็บโค้ดไว้
  // (query ?ref= หรือ localStorage จากหน้า /invite สำหรับคนที่ยังไม่ล็อกอิน) แล้วยิง POST /api/referral
  // **หลัง**บันทึกโปรไฟล์สำเร็จเท่านั้น (cookie-mumate-id ต้องพร้อม); โค้ดล้ม ❌ ห้ามพังการสมัคร —
  // ใส่ใหม่ได้ที่ /v2/qi
  const applyReferral = useReferralApply()
  const [referral, setReferral] = useState(() => {
    const q = router.query.ref
    const v = Array.isArray(q) ? q[0] : q
    if (typeof v === 'string' && /^[A-Za-z0-9]{4,32}$/.test(v)) return v
    // คนที่เข้าทาง /invite ตอนยังไม่ล็อกอิน — โค้ดรออยู่ใน storage จนมาถึงหน้านี้
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('v2:referral')
        if (saved && /^[A-Za-z0-9]{4,32}$/.test(saved)) return saved
      }
    } catch { /* storage ปิด — ช่องว่างธรรมดา */ }
    return ''
  })

  // team.mp4 2026-09 — @name ไม่ซ้ำกัน (โชว์จางๆ คู่ชื่อจริงเหมือน LINE): เช็คซ้ำกับ engine ตอน blur
  // และอีกครั้งก่อนบันทึก — ถ้าซ้ำ ❌ ไม่บันทึกอะไรเลย (โปรไฟล์ยังไม่ save) ให้ผู้ใช้แก้ชื่อแล้วกดใหม่;
  // ช่องไม่บังคับ — ปล่อยว่าง = ไม่มี @name (ตั้งตาหลังได้ที่ /v2/qi)
  const NAME_RE = /^[0-9A-Za-z_\u0E00-\u0E7F.]{4,24}$/
  const [displayName, setDisplayName] = useState('')
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  const checkDisplayName = async (): Promise<boolean> => {
    const v = displayName.trim()
    if (!v) { setNameStatus('idle'); return true }
    if (!NAME_RE.test(v)) { setNameStatus('invalid'); return false }
    setNameStatus('checking')
    try {
      const r = await fetch(`/api/v2/display-name?check=${encodeURIComponent(v)}`)
      const j = (await r.json().catch(() => ({}))) as { available?: boolean }
      const ok = j.available !== false
      setNameStatus(ok ? 'ok' : 'taken')
      return ok
    } catch {
      setNameStatus('ok') // เช็คไม่ได้ (เน็ตล่ม) — ปล่อยผ่าน ให้ตัวจริง (unique index) เป็นด่านสุดท้าย
      return true
    }
  }
  const onSubmitWithExtras = async () => {
    const v = displayName.trim()
    if (v && !(await checkDisplayName())) return // ชื่อซ้ำ/ผิดรูปแบบ → หยุดก่อน save โปรไฟล์
    await form.onSubmit() // สำเร็จจะ navigate ไป /v2 เอง — POST ที่เหลือยิงต่อได้ (SPA nav ไม่ฆ่า JS)
    const code = referral.trim()
    if (code) {
      const ok = await applyReferral(code)
      // ใช้แล้วเอาออกจาก storage กันยิงซ้ำตอนกลับมาสมัคร/แก้ข้อมูลรอบหน้า; ไม่ ok ก็ทิ้งไว้ให้ลองที่ /v2/qi
      if (ok) {
        try { window.localStorage.removeItem('v2:referral') } catch { /* ไม่มีผลกับการสมัคร */ }
      }
    }
    if (v) {
      try {
        const r = await fetch('/api/v2/display-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: v }),
        })
        if (!r.ok) {
          // แข่งชื่อซ้ำข้ามคนในชั่ววูบ — เก็บรอไว้ให้ตั้งใหม่ที่ /v2/qi แทนการเสียการสมัคร
          try { window.localStorage.setItem('v2:pending-display-name', v) } catch { /* ignore */ }
        }
      } catch { /* ignore — ตั้งใหม่ได้ที่ /v2/qi */ }
    }
  }

  // #246 — authed-but-no-MEMBER_ID limbo would spin AuthLoadingGate forever here too. Offer re-login.
  if (identityStuck) return <ScreenIdentityStuck callbackUrl="/v2" />
  if (showLoading || status !== 'authed') return <AuthLoadingGate />

  const f = form.fields
  const timeError = !form.isTimeValid

  return (
    <RegisterView onSubmit={onSubmitWithExtras} submitting={form.submitting} canSubmit={form.canSubmit}>
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

      {/* team.mp4 2026-09 — @name ไม่ซ้ำกัน โชว์จางๆ คู่ชื่อจริง (เหมือน LINE); ไม่บังคับ */}
      <Field
        label="ชื่อแสดง @name (ไม่บังคับ)"
        placeholder="เช่น somchai_j — 4-24 ตัวอักษร"
        value={displayName}
        error={nameStatus === 'taken' || nameStatus === 'invalid'}
        onChange={(e) => { setDisplayName(e.target.value); if (nameStatus !== 'idle') setNameStatus('idle') }}
        onBlur={() => { if (displayName.trim()) void checkDisplayName() }}
      />
      {nameStatus === 'taken' ? (
        <p className="font-ibm text-xs leading-[18px] text-v3-error">ชื่อนี้ถูกใช้แล้ว ลองชื่ออื่น</p>
      ) : null}
      {nameStatus === 'invalid' ? (
        <p className="font-ibm text-xs leading-[18px] text-v3-error">ใช้ได้ไทย/อังกฤษ/ตัวเลข/_ /. ยาว 4-24 ตัวอักษร</p>
      ) : null}

      <Field
        label="โค้ดผู้แนะนำ (ไม่บังคับ)"
        placeholder="เช่น MUMATE123"
        value={referral}
        onChange={(e) => setReferral(e.target.value)}
      />
      {form.error ? (
        <p className="font-ibm text-xs leading-[18px] text-v3-error">{form.error}</p>
      ) : null}
    </RegisterView>
  )
}

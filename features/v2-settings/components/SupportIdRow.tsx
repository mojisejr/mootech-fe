// "ID สมาชิก" — the member's full user_id with a copy button (mumate-member-identity-hardening-001 slice 1).
//
// Members send it to the team on LINE when asked; support pastes it into /ops/users, which matches the
// exact UUID. The caller passes the id from the /api/user row (the signed caller's own), never the
// MEMBER_ID cookie. Owner decision 2026-10-02: full UUID, a copy button, no short code, no extra gate.
import { useState } from 'react'

/** Clipboard API first; LINE's in-app browser often lacks it, so fall back to a selected textarea. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // denied or unavailable — try the fallback
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function SupportIdRow({ userId }: { userId: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const onCopy = async () => {
    setState((await copyText(userId)) ? 'copied' : 'failed')
  }
  return (
    <div data-testid="settings-support-id" className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-5 text-v3-navy">ID สมาชิก</span>
          <span data-testid="settings-support-id-value" className="mt-0.5 block select-all break-all font-mono text-[12px] leading-4 text-v3-text-body">{userId}</span>
        </span>
        <button
          type="button"
          onClick={() => { void onCopy() }}
          data-testid="settings-support-id-copy"
          className="flex-none rounded-full border border-v3-border-card px-3 py-1.5 text-[13px] font-bold text-v3-navy"
        >
          {state === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอก'}
        </button>
      </div>
      <span className="mt-1.5 block text-[12px] leading-4 text-v3-text-muted">
        {state === 'failed'
          ? 'คัดลอกอัตโนมัติไม่ได้ กดค้างที่ ID เพื่อคัดลอกเอง'
          : 'ส่ง ID นี้ให้ทีมงานทาง LINE เมื่อทีมงานขอ เพื่อให้ช่วยดูบัญชีของคุณได้ตรงคน'}
      </span>
    </div>
  )
}

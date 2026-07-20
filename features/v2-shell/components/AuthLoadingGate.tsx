// MuMate v2 — auth loading gate with a strand escape (#1 from the loop-safety review).
//
// The global identity self-heal (_app <IdentitySelfHeal/>) mints MEMBER_ID ONCE, after a 3s delay,
// and on a network failure it releases its guard but does NOT auto-retry — so a /v2 page keyed on
// cookie-truth (useCurrentUser) can be pinned on ScreenLoading forever with no recovery. (The legacy
// /login accidentally escaped this by gating on raw useSession, which we deliberately don't.) So:
// show ScreenLoading normally, but after `timeoutMs` of still-loading, offer a manual recovery —
// a full reload re-mounts _app, re-arms the self-heal, and retries.
import { useEffect, useState } from 'react'
import ScreenLoading from '@/components/screen-loading'

export function AuthLoadingGate({ timeoutMs = 12000 }: { timeoutMs?: number }) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setStuck(true), timeoutMs)
    return () => clearTimeout(timer)
  }, [timeoutMs])

  if (!stuck) return <ScreenLoading />

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-v3-ghost-white px-6 text-center">
      <p className="text-neutral-600">ใช้เวลานานกว่าปกติ</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-v3-sapphire px-6 py-3 font-poppins-v3 font-semibold text-v3-lime"
      >
        โหลดใหม่อีกครั้ง
      </button>
      <a href="/v2/login" className="text-sm text-v3-sapphire underline">
        เข้าสู่ระบบใหม่
      </a>
    </div>
  )
}

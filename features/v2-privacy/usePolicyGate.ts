// features/v2-privacy/usePolicyGate.ts — the updated-policy gate for pages members open directly (chat).
// CIEL mumate-pdpa-reconsent-001: home reads the same fact off /api/user (no extra request); chat is entered
// straight from links, so it asks /api/v2/policy-consent once on mount. Only a clear "needed" redirects:
// a failed or unauthenticated check lets the member through ("ไม่รบกวน" — never lock anyone out on an error).
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export function usePolicyGate(): void {
  const router = useRouter()
  useEffect(() => {
    let alive = true
    void fetch('/api/v2/policy-consent')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { ok?: boolean; needed?: boolean } | null) => {
        if (alive && j?.ok && j.needed) {
          void router.replace(`/v2/policy-update?next=${encodeURIComponent(router.asPath)}`)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // once per mount: the page path is the "next" to come back to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

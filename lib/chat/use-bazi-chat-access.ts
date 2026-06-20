import { useEffect, useState } from "react"

// Client hook for the bazi chat access gate. Calls /api/chat/access once on mount; the server
// decides visibility from the auth cookie + allowlist. Returns the userId only when enabled
// (used to key per-user chat history in localStorage).
export interface BaziChatAccess {
  enabled: boolean
  userId: string
  loading: boolean
}

export function useBaziChatAccess(): BaziChatAccess {
  const [state, setState] = useState<BaziChatAccess>({
    enabled: false,
    userId: "",
    loading: true,
  })

  useEffect(() => {
    let alive = true
    fetch("/api/chat/access")
      .then((r) => (r.ok ? r.json() : { enabled: false, userId: "" }))
      .then((j) => {
        if (alive)
          setState({ enabled: !!j?.enabled, userId: j?.userId ?? "", loading: false })
      })
      .catch(() => {
        if (alive) setState({ enabled: false, userId: "", loading: false })
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}

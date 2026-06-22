// React controller for multi-session chat (#mootech-chat-sessions).
// Wraps ChatSessionStore so the modal stays presentational: it owns the session list + active
// id, runs legacy migration on init (via the factory), and guarantees an active session exists.
//
// The modal keeps its own live `historyChat` (which includes transient loading bubbles) and:
//   - on switch/new -> loads the returned messages into historyChat
//   - on a settled turn -> calls persist(messages) to write the active session
import { useCallback, useEffect, useRef, useState } from "react"
import {
  getChatSessionStore,
  type ChatSession,
  type ChatSessionMessage,
  type ChatSessionStore,
} from "./session-store"

export type UseChatSessions = {
  /** sessions, most-recently-updated first */
  sessions: ChatSession[]
  activeId: string | null
  /** true once the store is hydrated and an active session is guaranteed */
  ready: boolean
  /** create a fresh empty session, make it active; returns its id */
  newSession: () => string | null
  /** switch active session; returns that session's persisted messages to load into the view */
  switchTo: (id: string) => ChatSessionMessage[]
  rename: (id: string, title: string) => void
  /** remove a session; if it was active, falls back to the latest or a new empty one */
  remove: (id: string) => ChatSessionMessage[]
  /** persist the active session's messages (call when a turn settles, not mid-stream) */
  persist: (messages: ChatSessionMessage[]) => void
}

export function useChatSessions(userId: string): UseChatSessions {
  const storeRef = useRef<ChatSessionStore | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(() => {
    const store = storeRef.current
    if (store) setSessions(store.list())
  }, [])

  useEffect(() => {
    if (!userId) {
      setReady(false)
      return
    }
    // factory runs one-time legacy migration (bazi-chat-history:{userId} -> a session)
    const store = getChatSessionStore(userId)
    storeRef.current = store

    let list = store.list()
    let active = store.getActiveId()
    if (!active || !store.get(active)) {
      const seed = list[0] ?? store.create()
      active = seed.id
      store.setActiveId(active)
      list = store.list()
    }
    setSessions(list)
    setActiveId(active)
    setReady(true)
  }, [userId])

  const newSession = useCallback((): string | null => {
    const store = storeRef.current
    if (!store) return null
    const s = store.create()
    setActiveId(s.id)
    refresh()
    return s.id
  }, [refresh])

  const switchTo = useCallback(
    (id: string): ChatSessionMessage[] => {
      const store = storeRef.current
      if (!store) return []
      const s = store.get(id)
      if (!s) return []
      store.setActiveId(id)
      setActiveId(id)
      refresh()
      return s.messages
    },
    [refresh],
  )

  const rename = useCallback(
    (id: string, title: string) => {
      storeRef.current?.rename(id, title)
      refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    (id: string): ChatSessionMessage[] => {
      const store = storeRef.current
      if (!store) return []
      store.remove(id)
      if (activeId !== id) {
        refresh()
        return store.get(activeId ?? "")?.messages ?? []
      }
      // removed the active session -> fall back to latest, else a fresh one
      const next = store.list()[0] ?? store.create()
      store.setActiveId(next.id)
      setActiveId(next.id)
      refresh()
      return next.messages
    },
    [activeId, refresh],
  )

  const persist = useCallback(
    (messages: ChatSessionMessage[]) => {
      const store = storeRef.current
      if (!store || !activeId) return
      store.setMessages(activeId, messages)
      refresh()
    },
    [activeId, refresh],
  )

  return { sessions, activeId, ready, newSession, switchTo, rename, remove, persist }
}

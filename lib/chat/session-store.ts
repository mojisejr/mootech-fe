// Multi-session chat persistence for the production bazi chat (#mootech-chat-sessions).
//
// The UI depends ONLY on the `ChatSessionStore` interface, so today's localStorage backend
// swaps to a DB-backed `ApiSessionStore` later with a one-line change in the factory.
//
// Identity: keyed by the real authenticated userId (resolved server-side via `cookie-mumate-id`,
// surfaced to the client by `useBaziChatAccess`). Sessions are namespaced per user so two
// accounts on one device never mix.
//
// ┌──────────────────────────────────────────────────────────────────────────────────────┐
// │ VOW (#mootech-chat-sessions): sessions are localStorage CLIENT-SIDE ONLY.               │
// │ The future DB seam MUST target a NEW additive table `bazi_chat_sessions` (mirror        │
// │ `bazi_reading_sessions`). It MUST NOT touch `bazi_chat_histories` (LINE short-term       │
// │ memory) and MUST NOT enable bazi server-side conversation continuity.                    │
// │ SWAP POINT: implement `ApiSessionStore` (typed stub at the bottom) → BFF                 │
// │ `/api/chat/sessions` → bazi `bazi_chat_sessions`, then return it from getChatSessionStore.│
// └──────────────────────────────────────────────────────────────────────────────────────┘

// --- domain model (shape mirrors the future `bazi_chat_sessions` row) ---
export type ChatSessionMessage = {
  id: string
  message: string
  is_ai: boolean
}

export type ChatSession = {
  id: string
  title: string
  messages: ChatSessionMessage[]
  createdAt: number
  updatedAt: number
}

// --- the seam: UI/hook depend only on this ---
export interface ChatSessionStore {
  list(): ChatSession[]
  get(id: string): ChatSession | null
  create(): ChatSession
  rename(id: string, title: string): void
  remove(id: string): void
  /** persist the whole message array (auto-titles from the first user turn, bumps updatedAt) */
  setMessages(id: string, messages: ChatSessionMessage[]): void
  getActiveId(): string | null
  setActiveId(id: string): void
}

// --- minimal storage contract (DI) so the store is testable without a browser ---
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const MAX_SESSIONS = 50
export const DEFAULT_TITLE = "แชทใหม่"

const sessionsKey = (userId: string) => `bazi-chat-sessions:v1:${userId}`
const activeKey = (userId: string) => `bazi-chat-active-session:${userId}`
const migratedKey = (userId: string) => `bazi-chat-migrated:v1:${userId}`
// legacy single-thread history written by the pre-sessions modal (do NOT delete — append-only)
const legacyHistoryKey = (userId: string) => `bazi-chat-history:${userId}`

const genId = (): string => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export const titleFromMessages = (messages: ChatSessionMessage[]): string => {
  const firstUser = messages.find((m) => !m.is_ai)?.message?.trim()
  if (!firstUser) return DEFAULT_TITLE
  return firstUser.length > 40 ? `${firstUser.slice(0, 40)}…` : firstUser
}

export class LocalStorageSessionStore implements ChatSessionStore {
  constructor(
    private readonly userId: string,
    private readonly storage: StorageLike,
    // injectable clock — defaults to wall time; tests pass a monotonic counter so
    // same-millisecond ordering is deterministic.
    private readonly now: () => number = () => Date.now(),
  ) {}

  private read(): ChatSession[] {
    if (!this.userId) return []
    try {
      const raw = this.storage.getItem(sessionsKey(this.userId))
      const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private write(sessions: ChatSession[]): void {
    if (!this.userId) return
    // soft cap: keep the most-recently-updated MAX_SESSIONS (guard vs localStorage bloat)
    const trimmed = [...sessions]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_SESSIONS)
    try {
      this.storage.setItem(sessionsKey(this.userId), JSON.stringify(trimmed))
    } catch {
      // quota / serialization failure — non-fatal
    }
  }

  list(): ChatSession[] {
    return this.read().sort((a, b) => b.updatedAt - a.updatedAt)
  }

  get(id: string): ChatSession | null {
    return this.read().find((s) => s.id === id) ?? null
  }

  create(): ChatSession {
    const now = this.now()
    const session: ChatSession = {
      id: genId(),
      title: DEFAULT_TITLE,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    this.write([session, ...this.read()])
    this.setActiveId(session.id)
    return session
  }

  rename(id: string, title: string): void {
    const next = this.read().map((s) =>
      s.id === id
        ? { ...s, title: title.trim() || DEFAULT_TITLE, updatedAt: this.now() }
        : s,
    )
    this.write(next)
  }

  remove(id: string): void {
    this.write(this.read().filter((s) => s.id !== id))
    if (this.getActiveId() === id) {
      try {
        this.storage.removeItem(activeKey(this.userId))
      } catch {
        // non-fatal
      }
    }
  }

  setMessages(id: string, messages: ChatSessionMessage[]): void {
    const next = this.read().map((s) => {
      if (s.id !== id) return s
      const keepTitle = s.title && s.title !== DEFAULT_TITLE
      return {
        ...s,
        messages,
        title: keepTitle ? s.title : titleFromMessages(messages),
        updatedAt: this.now(),
      }
    })
    this.write(next)
  }

  getActiveId(): string | null {
    if (!this.userId) return null
    try {
      return this.storage.getItem(activeKey(this.userId))
    } catch {
      return null
    }
  }

  setActiveId(id: string): void {
    if (!this.userId) return
    try {
      this.storage.setItem(activeKey(this.userId), id)
    } catch {
      // non-fatal
    }
  }
}

// Migrate the legacy single-thread history into one session, ONCE per user.
// Idempotent (guarded by a marker); never deletes the legacy key (append-only). Returns the
// created session id, or null if nothing to migrate / already migrated.
export function migrateLegacyHistory(
  userId: string,
  storage: StorageLike,
): string | null {
  if (!userId) return null
  try {
    if (storage.getItem(migratedKey(userId))) return null
  } catch {
    return null
  }

  let legacy: ChatSessionMessage[] = []
  try {
    const raw = storage.getItem(legacyHistoryKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) {
      legacy = parsed
        .filter((m) => m && typeof m.message === "string")
        .map((m) => ({
          id: typeof m.id === "string" ? m.id : genId(),
          message: m.message,
          is_ai: !!m.is_ai,
        }))
    }
  } catch {
    legacy = []
  }

  // mark migrated regardless, so we never re-run (empty legacy = nothing to carry)
  const markMigrated = () => {
    try {
      storage.setItem(migratedKey(userId), "1")
    } catch {
      // non-fatal
    }
  }

  if (legacy.length === 0) {
    markMigrated()
    return null
  }

  const store = new LocalStorageSessionStore(userId, storage)
  // only seed if the user has no sessions yet (don't duplicate on re-entry)
  if (store.list().length > 0) {
    markMigrated()
    return null
  }

  const session = store.create()
  store.setMessages(session.id, legacy)
  store.setActiveId(session.id)
  markMigrated()
  return session.id
}

// SSR-safe no-op store (no window/localStorage): list() === [] and writes are ignored.
class NullSessionStore implements ChatSessionStore {
  list(): ChatSession[] {
    return []
  }
  get(): ChatSession | null {
    return null
  }
  create(): ChatSession {
    const now = Date.now()
    return { id: genId(), title: DEFAULT_TITLE, messages: [], createdAt: now, updatedAt: now }
  }
  rename(): void {}
  remove(): void {}
  setMessages(): void {}
  getActiveId(): string | null {
    return null
  }
  setActiveId(): void {}
}

// Factory: localStorage-backed in the browser, no-op on the server. Runs legacy migration once.
export function getChatSessionStore(userId: string): ChatSessionStore {
  const ls =
    typeof window !== "undefined"
      ? (window.localStorage as unknown as StorageLike)
      : null
  if (!ls || !userId) return new NullSessionStore()
  migrateLegacyHistory(userId, ls)
  return new LocalStorageSessionStore(userId, ls)
}

// ───────────────────────────────────────────────────────────────────────────────────────
// TODO(db): ApiSessionStore — DB-backed, cross-device. Implement when DB + identity are ready.
// Must satisfy the SAME `ChatSessionStore` interface so swapping is one line in the factory.
//
// export class ApiSessionStore implements ChatSessionStore {
//   // GET    /api/chat/sessions        -> list()
//   // GET    /api/chat/sessions/:id    -> get()
//   // POST   /api/chat/sessions        -> create()
//   // PATCH  /api/chat/sessions/:id    -> rename() / setMessages()
//   // DELETE /api/chat/sessions/:id    -> remove()
//   // (server persists to bazi `bazi_chat_sessions`, keyed by the cookie-resolved user id;
//   //  NEVER `bazi_chat_histories`, NEVER bazi server continuity)
// }
// ───────────────────────────────────────────────────────────────────────────────────────

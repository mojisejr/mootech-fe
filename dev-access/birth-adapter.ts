// dev-access lane — birth-adapter
// Maps a dev-only birth profile (kept in localStorage) to the bazi RawInput shape.
// This is a DEV SCAFFOLD: later the birth source is swapped to the real profile
// without touching the chat component. See plan:
// ψ/memory/logs/mootech-fe-fork/2026-06-09_23-31_bazi-chat-playground-lane-plan.md

export type DevBirthProfile = {
  dob: string // "YYYY-MM-DD"
  time: string // "HH:mm" or ""
  gender: string // "MALE" | "FEMALE" (mootech style) — normalized to lowercase for bazi
  isRememberTime: boolean
}

export type BaziRawInput = {
  birthDate: string
  birthTime: string
  gender: string
  province: string
  calendarSystem: "solar" | "lunar"
}

const STORAGE_KEY = "dev-bazi-birth-profile"

// Locked decisions (#mootech-bazi-chat-lane):
export const DEFAULT_PROVINCE = "Bangkok"
export const DEFAULT_UNKNOWN_TIME = "12:00"

export function isUnknownTime(p: DevBirthProfile): boolean {
  return !p.isRememberTime || p.time.trim() === ""
}

// Pure function — safe to import on server (no window access).
export function toBaziRawInput(p: DevBirthProfile): BaziRawInput {
  const birthTime = isUnknownTime(p) ? DEFAULT_UNKNOWN_TIME : p.time.trim()
  return {
    birthDate: p.dob.trim(),
    birthTime,
    gender: p.gender.trim().toLowerCase(),
    province: DEFAULT_PROVINCE,
    calendarSystem: "solar",
  }
}

export function loadBirthProfile(): DevBirthProfile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DevBirthProfile) : null
  } catch {
    return null
  }
}

export function saveBirthProfile(p: DevBirthProfile): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

export function clearBirthProfile(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

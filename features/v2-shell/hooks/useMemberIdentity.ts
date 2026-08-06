// MuMate v2 — the member's display identity (picture + name) read straight from the login cookies, so ANY v2
// shell screen can show the real avatar WITHOUT a fetch. ฟีม 2026-08-06 "ทาง ข": avatar = รูปจริง → มาสคอต,
// ตัดอักษรย่อทิ้ง. This hook is the SOURCE only (goo · ส่วน 1/2). The consumer (TopBarAvatar wiring · ส่วน 2 ·
// μุน) applies precedence: an explicitly-passed prop WINS over the cookie — home passes avatarPictureUrl, so
// that path must not regress.
//
// The photo lives in the MEMBER_IMAGE cookie (set at login from the OAuth picture_url). This is NOT a new
// trick: the v1 header already reads it the exact same way (components/header-v2.tsx:44) — proven pattern.
// ZERO network by construction: this reads client cookies only — no fetch/axios/API import anywhere here.
import { useMemo } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'

export interface MemberIdentity {
  /** the real avatar photo (MEMBER_IMAGE). `null` — never '' — when the cookie is empty/undefined, so the
   *  consumer falls through to the mascot cleanly instead of rendering an empty <img src="">. */
  pictureUrl: string | null
  /** display name (MEMBER_NAME); '' when absent. Under ทาง ข the letter-initial is dropped, so this is for
   *  alt / aria-label only, not a visible fallback. */
  name: string
}

/**
 * Read the logged-in member's display identity from cookies. Same `useCookies` source as the v1 header, so it
 * resolves on first paint (no navigate-away-and-back, no extra request). Returns a stable object per cookie
 * value so consumers don't re-render / flicker while nothing changed.
 */
export function useMemberIdentity(): MemberIdentity {
  const [cookies] = useCookies([CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_NAME])
  const rawImage = cookies[CookieKey.MEMBER_IMAGE]
  const rawName = cookies[CookieKey.MEMBER_NAME]
  return useMemo<MemberIdentity>(() => {
    const pic = typeof rawImage === 'string' ? rawImage.trim() : ''
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    return { pictureUrl: pic !== '' ? pic : null, name }
  }, [rawImage, rawName])
}

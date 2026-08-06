// MuMate v2 — the member's display identity (picture + name) read straight from the login cookies, so ANY v2
// shell screen can show the real avatar WITHOUT a fetch. ฟีม 2026-08-06 "ทาง ข": avatar = รูปจริง → มาสคอต,
// ตัดอักษรย่อทิ้ง. This hook is the SOURCE only (goo · ส่วน 1/2). The consumer (TopBarAvatar wiring · ส่วน 2 ·
// μุน) applies precedence: an explicitly-passed prop WINS over the cookie — home passes avatarPictureUrl, so
// that path must not regress.
//
// The photo lives in the MEMBER_IMAGE cookie (set at login from the OAuth picture_url). This is NOT a new
// trick: the v1 header already reads it the exact same way (components/header-v2.tsx:44) — proven pattern.
// ZERO network by construction: this reads client cookies only — no fetch/axios/API import anywhere here.
//
// 🔴 HYDRATION (#193, ตู๋): the server has NO access to the browser cookie (_app's CookiesProvider is not
// SSR-populated), so it renders WITHOUT a photo → the mascot. If the client's first (hydration) render read the
// cookie and returned the photo, it would MISMATCH the server HTML, and React 18 keeps the server DOM on a
// content mismatch — the mascot then stays stuck on a fresh page load (LINE/refresh/first visit) until an
// in-app navigation remounts the subtree. So we gate the cookie behind a `mounted` flag: return the SSR-safe
// value (null → mascot) on the server AND on the hydration pass so they MATCH (no mismatch), then flip after
// mount to the real photo. Fresh load now UPGRADES mascot → photo one tick after hydration instead of being
// stuck on the mascot. Cost accepted (ฟีม): users with a photo see a one-time mascot→photo swap on first load;
// this hook is the floor that makes the photo appear at all — an optional per-page SSR prop (ทาง ข) can remove
// the swap later without changing this contract.
import { useEffect, useMemo, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'

export interface MemberIdentity {
  /** the real avatar photo (MEMBER_IMAGE). `null` — never '' — when the cookie is empty/undefined OR not yet
   *  readable (pre-mount), so the consumer falls through to the mascot cleanly instead of an empty <img src="">. */
  pictureUrl: string | null
  /** display name (MEMBER_NAME); '' when absent/pre-mount. Under ทาง ข the letter-initial is dropped, so this is
   *  for alt / aria-label only, not a visible fallback (so its post-mount fill is not a visible swap). */
  name: string
}

/**
 * Read the logged-in member's display identity from cookies. SSR-safe: returns the neutral (no-photo) value on
 * the server and on the hydration pass so they match, then resolves the real cookie value one tick AFTER mount
 * (a fresh load upgrades mascot → photo; it does not resolve on the very first paint). No extra request. Returns
 * a stable object per resolved value so consumers don't re-render while nothing changed.
 */
export function useMemberIdentity(): MemberIdentity {
  const [cookies] = useCookies([CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_NAME])
  // Gate the cookie behind mount so the SSR HTML and the client's hydration render agree (both no-photo);
  // flipping this after mount is what forces the one re-render that swaps in the real photo (#193).
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const rawImage = mounted ? cookies[CookieKey.MEMBER_IMAGE] : undefined
  const rawName = mounted ? cookies[CookieKey.MEMBER_NAME] : undefined
  return useMemo<MemberIdentity>(() => {
    const pic = typeof rawImage === 'string' ? rawImage.trim() : ''
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    return { pictureUrl: pic !== '' ? pic : null, name }
  }, [rawImage, rawName])
}

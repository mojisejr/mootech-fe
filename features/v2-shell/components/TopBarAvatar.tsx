// features/v2-shell/components/TopBarAvatar.tsx — the profile avatar shared by every v2 top-bar.
// Extracted from home's local AvatarButton. Same two-axis shape as TopBarBell (behaviour + skin as props),
// so the avatar's action changes in ONE place.
//
//   • BEHAVIOUR — `onClick` (open the logout menu, home/service) or `href` (nav). Interactive variants only.
//   • SKIN — `variant`: 'sapphire' (home/service: sapphire ground, profile picture or first-letter, an
//     interactive button/link) · 'mate' (calendar: a DECORATIVE gradient placeholder — no picture, no
//     action, aria-hidden, exactly as the calendar day-header ships today). Each reproduces its page's
//     current pixels so nothing shifts; ฟีม's future unified look = one variant edit.
//
// ⚠️ 2026-08-03 — the 'mate' variant is NO LONGER USED anywhere. ฟีม answered the "which look wins" question
// directly ("กระดิ่ง + avatar รวมเป็นแบบเดียวทั้ง app มันควรจะเป็นแบบนั้น"), so the calendar flow now renders
// the same solid/sapphire skin as home and service. Kept, not deleted (Rule 1): it is the record of what the
// calendar screens looked like before the unification, and re-instating it is a one-word prop change.
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

type TopBarAvatarProps = {
  variant?: 'sapphire' | 'mate'
  /** display name — first letter is the fallback glyph (sapphire only). */
  name?: string
  /** profile picture; null/404 → letter fallback (sapphire only). */
  pictureUrl?: string | null
  /** in-page action (e.g. open logout menu). sapphire only, mutually exclusive with href. */
  onClick?: () => void
  /** nav target. sapphire only, mutually exclusive with onClick. */
  href?: string
  label?: string
}

// interactive sapphire avatar — owns its own image-broken state (a picture_url that 404s falls back to the
// letter, never a broken image). Reproduces home's AvatarButton markup exactly.
function SapphireAvatar({ name = '', pictureUrl = null, onClick, href, label = 'โปรไฟล์' }: Omit<TopBarAvatarProps, 'variant'>) {
  const [broken, setBroken] = useState(false)
  const showImg = !!pictureUrl && !broken
  const inner = showImg
    ? <Image src={pictureUrl as string} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} onError={() => setBroken(true)} />
    : <span data-testid="avatar-letter">{name.trim().charAt(0) || 'F'}</span>
  const cls = 'relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white'
  if (href) return <Link href={href} aria-label={label} className={cls}>{inner}</Link>
  // No href AND no onClick → the page has no avatar action yet (the calendar flow). ฟีม's ruling is that the
  // avatar must LOOK the same everywhere; it does not say every page must invent a menu. Render the identical
  // tile as a <span> rather than a <button> that swallows the tap — same pixels, no lie.
  if (!onClick) return <span data-testid="avatar-static" className={cls}>{inner}</span>
  return <button type="button" aria-label={label} onClick={onClick} className={cls}>{inner}</button>
}

export function TopBarAvatar({ variant = 'sapphire', ...rest }: TopBarAvatarProps) {
  if (variant === 'mate') {
    // calendar's decorative placeholder — no picture, no action, aria-hidden.
    return <span aria-hidden className="size-10 shrink-0 rounded-full bg-gradient-to-br from-v3-pastel-blue to-v3-mate-purple ring-2 ring-white" />
  }
  return <SapphireAvatar {...rest} />
}

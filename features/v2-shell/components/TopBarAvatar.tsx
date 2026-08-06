// features/v2-shell/components/TopBarAvatar.tsx — the profile avatar shared by every v2 top-bar.
// Extracted from home's local AvatarButton. Same two-axis shape as TopBarBell (behaviour + skin as props),
// so the avatar's action changes in ONE place.
//
//   • BEHAVIOUR — `onClick` (open the logout menu, home/service) or `href` (nav). Interactive variants only.
//   • SKIN — `variant`: 'sapphire' (home/service: sapphire ground, profile picture or the mascot, an
//     interactive button/link) · 'mate' (calendar: a DECORATIVE gradient placeholder — no picture, no
//     action, aria-hidden, exactly as the calendar day-header ships today). Each reproduces its page's
//     current pixels so nothing shifts; ฟีม's future unified look = one variant edit.
//
// ⚠️ 2026-08-03 — the 'mate' variant is NO LONGER USED anywhere. ฟีม answered the "which look wins" question
// directly ("กระดิ่ง + avatar รวมเป็นแบบเดียวทั้ง app มันควรจะเป็นแบบนั้น"), so the calendar flow now renders
// the same solid/sapphire skin as home and service. Kept, not deleted (Rule 1): it is the record of what the
// calendar screens looked like before the unification, and re-instating it is a one-word prop change.
//
// ── ทาง ข (ฟีม 2026-08-06): รูปจริง → มาสคอต. THE LETTER IS GONE. ───────────────────────────────────────
// The avatar showed a literal "F" on every screen except home, because only home passed `name` and the
// fallback was `name.charAt(0) || 'F'`. ฟีม cut the initial rather than repair it, and his reason is the
// sharp one: the letter is what MADE the bug. A glyph derived from a field most callers never pass will
// keep finding ways to render someone else's placeholder. A mascot has no such mode — it is either there or
// the file 404s, and a 404 is loud.
//
// The source falls through by itself now: an explicitly-passed prop still WINS (home passes
// avatarPictureUrl and must not regress), then goo's useMemberIdentity() cookie, then the mascot. No screen
// has to pass anything for the avatar to be right — which is the actual fix, because the old bug was every
// screen having to remember to.
//
// MASCOT FILE: /images/v2/mascot/01-nav.png (202×240, 63 KB) — deliberately NOT 01.png. They are the SAME
// artwork at different resolutions and 01.png is 1.4 MB, twenty-two times larger, for a 40px circle that
// cannot show the difference. 01-nav is already loaded by MateAIButton, so on most screens it costs nothing.
//
// THE CROP is measured, not guessed. At 1:1 the whole standing body lands in the circle and the face is a
// few pixels across. I rendered six candidates at the real 40px and looked: 2.0× and tighter cut off the
// blue helmet and orange ears, which are what make the character recognisable at that size — the face alone
// reads as a cream blob. 1.6× anchored to the top keeps face AND ears inside the circle.
import { ComingSoonAction } from './ComingSoon'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useMemberIdentity } from '../hooks/useMemberIdentity'

/** the fallback mascot + the crop that makes it read as a face at 40px (see the note above). */
const AVATAR_MASCOT = {
  src: '/images/v2/mascot/01-nav.png',
  /** 1.6× the circle, pulled up so the head — not the body — fills it.
   *  -18% and not the -30% the standalone prototype suggested: inside the real grid-centred parent the
   *  same numbers clipped the helmet, so the offset was re-measured against the actual component. Tried
   *  -30 / -18 / -12 at the real size and looked at all three — -30 cut the eyes, -12 pushed the smile to
   *  the very bottom edge, -18 puts eyes, beak and mouth in frame with the blue helmet still around them. */
  style: { width: '160%', height: '160%', margin: '-18% 0 0 -30%', objectFit: 'cover', objectPosition: '50% 6%' } as const,
}

type TopBarAvatarProps = {
  variant?: 'sapphire' | 'mate'
  /** display name — alt/aria text only. No longer a visible fallback (ทาง ข dropped the initial). */
  name?: string
  /** profile picture; absent → the cookie, then the mascot. null/404 → mascot, never a broken image. */
  pictureUrl?: string | null
  /** in-page action (e.g. open logout menu). sapphire only, mutually exclusive with href. */
  onClick?: () => void
  /** nav target. sapphire only, mutually exclusive with onClick. */
  href?: string
  label?: string
}

// interactive sapphire avatar — owns its own image-broken state (a picture_url that 404s falls back to the
// MASCOT: never a broken image, and never a letter).
function SapphireAvatar({ name = '', pictureUrl, onClick, href, label = 'โปรไฟล์' }: Omit<TopBarAvatarProps, 'variant'>) {
  const [broken, setBroken] = useState(false)
  const identity = useMemberIdentity()
  // an explicitly-passed prop WINS over the cookie — home passes avatarPictureUrl and must not regress.
  // `??` and not `||`: '' is a value a caller chose to pass, and folding it into "absent" is the same
  // guessing-at-the-seam that produced the "F". goo's hook already returns null (never '') for an empty cookie.
  const photo = pictureUrl ?? identity.pictureUrl
  const showImg = !!photo && !broken
  const alt = name.trim() || identity.name.trim()
  const inner = showImg
    ? <Image src={photo as string} alt={alt} fill sizes="40px" style={{ objectFit: 'cover' }} onError={() => setBroken(true)} />
    : (
      // eslint-disable-next-line @next/next/no-img-element -- the zoom/offset crop cannot be expressed with
      // next/image fill + objectPosition, and the file is 63 KB already in cache on most screens.
      <img
        data-testid="avatar-mascot"
        src={AVATAR_MASCOT.src}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        // left-0/top-0 matter: with `absolute` alone the img keeps its STATIC position inside the
        // grid-centred parent, and the negative margins then pull from the wrong origin — the head came out
        // clipped at the top even though the numbers were right. Pinning the origin makes the crop mean what
        // it meant in the prototype it was measured in.
        className="absolute left-0 top-0 max-w-none"
        style={AVATAR_MASCOT.style}
      />
    )
  const cls = 'relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white'
  if (href) return <Link href={href} aria-label={label} className={cls}>{inner}</Link>
  // No href AND no onClick → the page has no avatar action yet (the calendar flow). ฟีม's ruling is that the
  // avatar must LOOK the same everywhere; it does not say every page must invent a menu. Render the identical
  // tile as a <span> rather than a <button> that swallows the tap — same pixels, no lie.
  // WAS a silent <span> (ฟีม's earlier ruling: no dead <button> that swallows the tap). ฟีม 2026-08-06
  // superseded it — silence is honest to the markup but on a phone it is indistinguishable from broken.
  // Same pixels, but the tap now gets an answer.
  if (!onClick) {
    return (
      <ComingSoonAction testId="avatar-static" label={label} message="โปรไฟล์กำลังจะมา เร็วๆ นี้" className={cls}>
        {inner}
      </ComingSoonAction>
    )
  }
  return <button type="button" aria-label={label} onClick={onClick} className={cls}>{inner}</button>
}

export function TopBarAvatar({ variant = 'sapphire', ...rest }: TopBarAvatarProps) {
  if (variant === 'mate') {
    // calendar's decorative placeholder — no picture, no action, aria-hidden.
    return <span aria-hidden className="size-10 shrink-0 rounded-full bg-gradient-to-br from-v3-pastel-blue to-v3-mate-purple ring-2 ring-white" />
  }
  return <SapphireAvatar {...rest} />
}

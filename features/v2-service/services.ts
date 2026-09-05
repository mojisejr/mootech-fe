// features/v2-service/services.ts — the 12 service-hub cards, TEXT FROZEN FROM FIGMA node 333:7519
// (file hEOnE9S6wLkMhb0Iy2Fe6T), read via get_design_context — NOT from บอง's screenshot inventory.
// Where the two diverged, Figma wins (dispatch rule): #4 "เคี้ยงคุง" (ไม้โท, บอง had เคี่ยงคุง), #5 tail
// "แดนสวรรค์" (was menu-obscured in บอง's shot).
//
// #7 "ซินแส" — DELIBERATE divergence from Figma, by ฟีม's explicit call (2026-07-29). Figma spells it
// "ซินเเส" (double สระเอ); I flagged it as a suspected typo, ฟีม confirmed the correct word is "ซินแส"
// (สระแอ) and ordered it fixed here. So this ONE card intentionally does NOT match Figma text — it matches
// ฟีม's ruling. (The Figma source should be corrected too; until then this is the source of truth.)
//
// This is a PRESENTATIONAL catalog: no fetch, no state, no auth. Ordering is Figma top→bottom (which
// matches บอง's down-each-column reading 1..6 then 7..12).

export type ServiceCardData = {
  /** stable slug — anchor keys + future image-slot wiring */
  id: string
  /* (the callable-by-id surface narrows this to a union below — see ServiceId) */
  /** card heading — navy bold 18/24, verbatim Figma */
  title: string
  /** body lines — 1 or 2 per Figma (medium 14/20); each entry = one <p> */
  desc: string[]
  /** destination. real routes for the 2 built screens; the shared "เร็วๆ นี้" page for the other 10. */
  href: string
  /** Full-card artwork (1128×463 = exactly 3.125× the 361×148 card). NOT the 122×90 box Figma drew:
   *  the delivered art is the whole card — flat #FBF6FA ground, mascot bleeding off the right edge and
   *  into the rounded corners, left half deliberately empty for this copy. Mapped BY ID, never by
   *  filename: the calendar file is spelled ปฎิทิน (ฎ ชฎา) while the title is ปฏิทิน (ฏ ปฏัก). */
  image?: string
  /** Shown only when there is art for it. `Healing Circles` is the one service with no delivered image
   *  (12 services, 11 files), so ฟีม ruled it hidden for now. The row STAYS here — it is hidden, not
   *  deleted — and hiding it means nothing links to that service any more: logged as A2, not silent. */
  hiddenUntilArt?: boolean
}

/** `/images/v2/features/*` — art lives under the id it belongs to, so a renamed file can never
 *  silently attach itself to the wrong service. */
const ART = (file: string) => `/images/v2/features/${file}`

const DESC_FORTUNE = ['วิเคราะห์ดวงชะตาเชิงลึก', 'รวบรวมเป็นหนังสือส่วนตัว']
const DESC_CALENDAR = ['วางแผนชีวิตตามจังหวะดวงดาว เลือกวันดี เลี่ยงวันไม่ดี', 'พร้อมแจ้งเตือนกิจกรรมมงคลที่เหมาะกับคุณโดยเฉพาะ']
const DESC_PLAN = ['วางแผนชีวิตตามจังหวะดวงดาว เลือกวันดี เลี่ยงวันไม่ดี']

/** the shared "เร็วๆ นี้" destination, carrying the service name so that page names what the user tapped */
export const comingSoonHref = (title: string): string => `/v2/service/coming-soon?service=${encodeURIComponent(title)}`

export const SERVICES = [
  // ดวงสมพงศ์ Slice 1: these two now enter the real compatibility flow (was comingSoonHref).
  { id: 'couple', title: 'ดูดวงคู่รัก', desc: DESC_FORTUNE, href: '/v2/service/compatibility/love', image: ART('01_ดูดวงคู่รัก.png') },
  { id: 'coworker', title: 'ดูดวงเพื่อนร่วมงาน', desc: DESC_FORTUNE, href: '/v2/service/compatibility/colleague', image: ART('02_ดูดวงเพื่อนร่วมงาน.png') },
  { id: 'one-book', title: 'หนังสือเล่มเดียวในโลก', desc: DESC_FORTUNE, href: '/v2/service/one-book', image: ART('03_หนังสือเล่มเดียวในโลก.png') },
  { id: 'oracle-kiang', title: 'เสี่ยงไพ่ออราเคิลเคี้ยงคุง', desc: DESC_FORTUNE, href: '/v2/fortune/oracle', image: ART('04_เสี่ยงไพ่ออราเคิลเคี้ยงคุง.png') },
  { id: 'spirit-heaven', title: 'เสี่ยงไพ่จิตวิญญาณแดนสวรรค์', desc: DESC_FORTUNE, href: '/v2/fortune/divine', image: ART('05_เสี่ยงไพ่จิตวิญญาณแดนสวรรค์.png') },
  { id: 'sian', title: 'เสี่ยงเซียนเสี่ยงทาย', desc: DESC_FORTUNE, href: '/v2/fortune/sage', image: ART('06_เสี่ยงเซียนเสี่ยงทาย.png') },
  { id: 'sinsae', title: 'ดูดวงส่วนตัว กับซินแส', desc: DESC_FORTUNE, href: comingSoonHref('ดูดวงส่วนตัว กับซินแส'), image: ART('07_ดูดวงส่วนตัวกับซินแส.png') },
  { id: 'manifest', title: 'มานิเฟส', desc: DESC_FORTUNE, href: comingSoonHref('มานิเฟส'), image: ART('08_มานิเฟส.png') },
  // filename says ปฎิทิน (ฎ ชฎา), the title says ปฏิทิน (ฏ ปฏัก) — different letters. Mapped by id on purpose.
  { id: 'calendar', title: 'ปฏิทิน', desc: DESC_CALENDAR, href: '/v2/calendar', image: ART('09_ปฎิทิน.png') },
  { id: 'healing-circles', title: 'Healing Circles', desc: DESC_CALENDAR, href: comingSoonHref('Healing Circles'), hiddenUntilArt: true },
  { id: 'sacred-map', title: 'แผนที่ศักดิ์สิทธิ์', desc: DESC_PLAN, href: comingSoonHref('แผนที่ศักดิ์สิทธิ์'), image: ART('10_แผนที่ศักดิ์สิทธิ์.png') },
  { id: 'shop', title: 'ร้านค้าของเรา', desc: DESC_PLAN, href: '/v2/shop', image: ART('11_ร้านค้าของเรา.png') },
  // #13, added 2026-08-08 — NOT from the Figma 12. The home screen (Zone 6) has been selling this since
  // #157, but it existed nowhere in the catalog, so its CTA had no name to send anywhere. Hidden for the
  // same reason as Healing Circles: the card art is 1128×463 full-card, and the only ปาจื่อ image we have
  // is the 569×436 illustration inside the blue home card — a different spec, not a substitute.
  { id: 'pajeu', title: 'เรียนปาจื่อออนไลน์', desc: DESC_FORTUNE, href: comingSoonHref('เรียนปาจื่อออนไลน์'), hiddenUntilArt: true },
] as const satisfies readonly ServiceCardData[]

/** Every id that exists, derived from the catalog itself — not a second list to keep in sync.
 *  This is what makes a mistyped id a COMPILE error. The first version of this helper took a `string`
 *  and threw on a miss, which sounded safe and was not: the throw runs during render, so a typo would
 *  have taken out the whole home screen (white page) while tsc stayed green the entire way — strictly
 *  worse than the wrong-link bug it was meant to prevent (บอง caught this). */
export type ServiceId = (typeof SERVICES)[number]['id']

/** Coming-soon destination BY ID. The home screen must send the exact catalog title, but its own copy is
 *  broken into display lines (`['เสี่ยงไพ่','ออราเคิล','เคี้ยงคุง']`) — joining those back together is how
 *  a stray space ends up in the URL and the page greets the user with the wrong name. So callers pass an
 *  id and the title is read from the catalog: the home screen holds no service-name string at all, and a
 *  renamed service follows automatically.
 *  Built once as a total map over ServiceId, so there is no lookup that can miss and therefore no
 *  runtime failure mode to choose a behaviour for. */
const COMING_SOON_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, comingSoonHref(s.title)])) as Record<ServiceId, string>

export const comingSoonHrefById = (id: ServiceId): string => COMING_SOON_BY_ID[id]

/** ปลายทางจริงของบริการตาม id — route จริงถ้า build แล้ว (services.ts `href`), ไม่งั้นตกไป coming-soon */
const HREF_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s.href])) as Record<ServiceId, string>
export const hrefById = (id: ServiceId): string => HREF_BY_ID[id]

/** what the hub actually renders. Kept as a derived list so `SERVICES` stays the full catalog — the
 *  hidden row is still inspectable, and un-hiding it is deleting one field, not re-typing a service. */
export const VISIBLE_SERVICES: readonly ServiceCardData[] = (SERVICES as readonly ServiceCardData[]).filter((s) => !s.hiddenUntilArt)

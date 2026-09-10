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

// คำอธิบายรายบริการ — เคยใช้ DESC_FORTUNE ก้อนเดียวกันทั้ง 8 การ์ด ("วิเคราะห์ดวงชะตาเชิงลึก / รวบรวมเป็นหนังสือ
// ส่วนตัว") ซึ่งเป็น copy ของ "หนังสือเล่มเดียวในโลก" — บน prod ทุกการ์ดเลยพูดเรื่องหนังสือ (เจอ 2026-09-07).
// แต่ละบรรทัดคือ 1 บรรทัดบนการ์ด — สั้นพอไม่ตัดคำบนจอ 375
const DESC_COUPLE = ['เช็คความเข้ากันของคุณกับคู่รัก', 'จากปาจื้อทั้งคู่ พร้อมคำแนะนำ']
const DESC_COWORKER = ['เทียบดวงคนร่วมงานได้ถึง 3 คน', 'จัดอันดับว่าใครเข้ากับคุณที่สุด']
const DESC_ONE_BOOK = ['วิเคราะห์ดวงชะตาเชิงลึก', 'รวบรวมเป็นหนังสือส่วนตัว']
const DESC_ORACLE = ['เปิดไพ่ออราเคิล 3 ใบ', 'รับข้อความชี้ทางจากจักรวาล']
const DESC_SPIRIT = ['ไพ่จิตวิญญาณจากแดนสวรรค์', 'ฟังเสียงภายในเพื่อคำตอบของใจ']
const DESC_SIAN = ['ตั้งจิตอธิษฐานแล้วเสี่ยงเซียมซี', 'รับคำทำนายรายด้านทันที']
const DESC_SINSAE = ['ปรึกษาซินแสตัวจริงแบบตัวต่อตัว', 'วางแผนชีวิตจากดวงของคุณ']
const DESC_MANIFEST = ['ตั้งเป้าหมาย เขียนคำยืนยัน', 'ทำภารกิจเล็ก ๆ ทุกวันให้เป็นจริง']
const DESC_LEARN = ['คอร์สปาจื่อออนไลน์ 15 บทเรียน', 'ปูพื้นฐาน อ่านดวงได้ด้วยตัวเอง']
// ปฏิทิน · Healing Circles · แผนที่ · ร้านค้า — verbatim Figma 626:2962 (2026-09-07). แผนที่/ร้านค้า เคยยืม copy ปฏิทิน (DESC_PLAN).
const DESC_CALENDAR = ['วางแผนชีวิตตามจังหวะดวงดาว', 'เลือกวันดี พร้อมแจ้งวันมงคล']
const DESC_HEALING = ['พื้นที่ปลอดภัยให้ทุกคนได้แบ่งปัน', 'ความรู้สึกรับฟังซึ่งกันและกัน']
const DESC_SACRED = ['แผนที่ศักดิ์สิทธิ์ที่รวบรวมสถานที่', 'พลังงานสูงพร้อมนำภายในที่ลึกซึ้ง']
const DESC_SHOP = ['เลือกสรรสินค้าเสริมพลังกาย', 'ใจ และจิตวิญญาณ']
const DESC_PHONE = ['ถอดพลังตัวเลขในเบอร์ของคุณ', 'เสริมดวงเงิน งาน และความรัก']
const DESC_HONEYCOMB = ['ถอดรหัสเบอร์แบบปิรามิดรังผึ้ง', 'อ่านพลังตัวเรา–ใกล้ตัว–ไกลตัว']

/** the shared "เร็วๆ นี้" destination, carrying the service name so that page names what the user tapped */
export const comingSoonHref = (title: string): string => `/v2/service/coming-soon?service=${encodeURIComponent(title)}`

export const SERVICES = [
  // ดวงสมพงศ์ Slice 1: these two now enter the real compatibility flow (was comingSoonHref).
  { id: 'couple', title: 'ดูดวงคู่รัก', desc: DESC_COUPLE, href: '/v2/service/compatibility/love', image: ART('01_ดูดวงคู่รัก.png') },
  { id: 'coworker', title: 'ดูดวงเพื่อนร่วมงาน', desc: DESC_COWORKER, href: '/v2/service/compatibility/colleague', image: ART('02_ดูดวงเพื่อนร่วมงาน.png') },
  { id: 'one-book', title: 'หนังสือเล่มเดียวในโลก', desc: DESC_ONE_BOOK, href: '/v2/service/one-book', image: ART('03_หนังสือเล่มเดียวในโลก.png') },
  { id: 'oracle-kiang', title: 'เสี่ยงไพ่ออราเคิลเคี้ยงคุง', desc: DESC_ORACLE, href: '/v2/fortune/oracle', image: ART('04_เสี่ยงไพ่ออราเคิลเคี้ยงคุง.png') },
  { id: 'spirit-heaven', title: 'เสี่ยงไพ่จิตวิญญาณแดนสวรรค์', desc: DESC_SPIRIT, href: '/v2/fortune/divine', image: ART('05_เสี่ยงไพ่จิตวิญญาณแดนสวรรค์.png') },
  { id: 'sian', title: 'เสี่ยงเซียนเสี่ยงทาย', desc: DESC_SIAN, href: '/v2/fortune/sage', image: ART('06_เสี่ยงเซียนเสี่ยงทาย.png') },
  { id: 'sinsae', title: 'ดูดวงส่วนตัว กับซินแส', desc: DESC_SINSAE, href: '/v2/service/sinsae', image: ART('07_ดูดวงส่วนตัวกับซินแส.png') },
  { id: 'manifest', title: 'มานิเฟส', desc: DESC_MANIFEST, href: '/v2/service/manifest', image: ART('08_มานิเฟส.png') },
  // filename says ปฎิทิน (ฎ ชฎา), the title says ปฏิทิน (ฏ ปฏัก) — different letters. Mapped by id on purpose.
  { id: 'calendar', title: 'ปฏิทิน', desc: DESC_CALENDAR, href: '/v2/calendar', image: ART('09_ปฎิทิน.png') },
  { id: 'healing-circles', title: 'Healing Circles', desc: DESC_HEALING, href: comingSoonHref('Healing Circles'), hiddenUntilArt: true },
  { id: 'sacred-map', title: 'แผนที่ศักดิ์สิทธิ์', desc: DESC_SACRED, href: '/v2/service/sacred-map', image: ART('10_แผนที่ศักดิ์สิทธิ์.png') },
  // ดูดวงเบอร์มือถือ — มีอาร์ตเต็มใบ (12_เบอร์มือถือ.png) + หน้าจริง /v2/service/phone-number (rebuild
  // ตาม Figma + คิด 10 QI + แคชรายวัน). อยู่ "ก่อนร้านค้า" (ฟีม 2026-09-10).
  { id: 'phone-number', title: 'ดูดวงเบอร์มือถือ', desc: DESC_PHONE, href: '/v2/service/phone-number', image: ART('12_เบอร์มือถือ.png') },
  // เบอร์รังผึ้ง (Honeycomb) — หน้า/engine พร้อมแล้ว (/v2/service/honeycomb). แสดงการ์ดเลย (ฟีมสั่ง 2026-09-10)
  // ยังไม่มีอาร์ตเต็มใบ → ServiceCardArt คืน null การ์ดเป็นพื้นเรียบ+ข้อความ (placeholder, ไม่ใช่รูปแตก).
  // ได้ภาพจาก Drive เมื่อไหร่ → ใส่ image: ART('13_เบอร์รังผึ้ง.png').
  { id: 'honeycomb', title: 'เบอร์รังผึ้ง', desc: DESC_HONEYCOMB, href: '/v2/service/honeycomb' },
  { id: 'shop', title: 'ร้านค้าของเรา', desc: DESC_SHOP, href: '/v2/shop', image: ART('11_ร้านค้าของเรา.png') },
  // #13, added 2026-08-08 — NOT from the Figma 12. The home screen (Zone 6) has been selling this since
  // #157, but it existed nowhere in the catalog, so its CTA had no name to send anywhere. Hidden for the
  // same reason as Healing Circles: the card art is 1128×463 full-card, and the only ปาจื่อ image we have
  // is the 569×436 illustration inside the blue home card — a different spec, not a substitute.
  { id: 'pajeu', title: 'เรียนปาจื่อออนไลน์', desc: DESC_LEARN, href: comingSoonHref('เรียนปาจื่อออนไลน์'), hiddenUntilArt: true },
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

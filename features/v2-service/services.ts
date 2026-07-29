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
  /** card heading — navy bold 18/24, verbatim Figma */
  title: string
  /** body lines — 1 or 2 per Figma (medium 14/20); each entry = one <p> */
  desc: string[]
  /** destination. real routes for the 2 built screens; the shared "เร็วๆ นี้" page for the other 10. */
  href: string
  /** image-slot source. undefined today (Figma ships gray placeholders); the slot ACCEPTS this so when
   *  the team drops real art in, no card is rewritten (done-condition #4). */
  image?: string
}

const DESC_FORTUNE = ['วิเคราะห์ดวงชะตาเชิงลึก', 'รวบรวมเป็นหนังสือส่วนตัว']
const DESC_CALENDAR = ['วางแผนชีวิตตามจังหวะดวงดาว เลือกวันดี เลี่ยงวันไม่ดี', 'พร้อมแจ้งเตือนกิจกรรมมงคลที่เหมาะกับคุณโดยเฉพาะ']
const DESC_PLAN = ['วางแผนชีวิตตามจังหวะดวงดาว เลือกวันดี เลี่ยงวันไม่ดี']

/** the shared "เร็วๆ นี้" destination, carrying the service name so that page names what the user tapped */
export const comingSoonHref = (title: string): string => `/v2/service/coming-soon?service=${encodeURIComponent(title)}`

export const SERVICES: ServiceCardData[] = [
  // ดวงสมพงศ์ Slice 1: these two now enter the real compatibility flow (was comingSoonHref).
  { id: 'couple', title: 'ดูดวงคู่รัก', desc: DESC_FORTUNE, href: '/v2/service/compatibility/love' },
  { id: 'coworker', title: 'ดูดวงเพื่อนร่วมงาน', desc: DESC_FORTUNE, href: '/v2/service/compatibility/colleague' },
  { id: 'one-book', title: 'หนังสือเล่มเดียวในโลก', desc: DESC_FORTUNE, href: comingSoonHref('หนังสือเล่มเดียวในโลก') },
  { id: 'oracle-kiang', title: 'เสี่ยงไพ่ออราเคิลเคี้ยงคุง', desc: DESC_FORTUNE, href: comingSoonHref('เสี่ยงไพ่ออราเคิลเคี้ยงคุง') },
  { id: 'spirit-heaven', title: 'เสี่ยงไพ่จิตวิญญาณแดนสวรรค์', desc: DESC_FORTUNE, href: comingSoonHref('เสี่ยงไพ่จิตวิญญาณแดนสวรรค์') },
  { id: 'sian', title: 'เสี่ยงเซียนเสี่ยงทาย', desc: DESC_FORTUNE, href: comingSoonHref('เสี่ยงเซียนเสี่ยงทาย') },
  { id: 'sinsae', title: 'ดูดวงส่วนตัว กับซินแส', desc: DESC_FORTUNE, href: comingSoonHref('ดูดวงส่วนตัว กับซินแส') },
  { id: 'manifest', title: 'มานิเฟส', desc: DESC_FORTUNE, href: comingSoonHref('มานิเฟส') },
  { id: 'calendar', title: 'ปฏิทิน', desc: DESC_CALENDAR, href: '/v2/calendar' },
  { id: 'healing-circles', title: 'Healing Circles', desc: DESC_CALENDAR, href: comingSoonHref('Healing Circles') },
  { id: 'sacred-map', title: 'แผนที่ศักดิ์สิทธิ์', desc: DESC_PLAN, href: comingSoonHref('แผนที่ศักดิ์สิทธิ์') },
  { id: 'shop', title: 'ร้านค้าของเรา', desc: DESC_PLAN, href: '/v2/shop' },
]

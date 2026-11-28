// features/v2-home/limited-offer.ts — ข้อมูล "โปรช่วงเวลา" สำหรับป๊อปอัปหน้าแรก (Home v3 รอบแรก · ประชุม 24 พ.ย. 2569 ข้อ 1). PURE
// ราคาทุกบาทมาจาก priceFor (ตัวคิดเดียวกับหน้า checkout) ผ่าน BFF /api/v2/limited-offer — จอไม่เคยคิดราคาเอง
// และไม่มีชื่อโค้ดส่วนลดอยู่ใน repository: เจ้าของตั้งผ่าน env (LIMITED_OFFER_PACKAGE + LIMITED_OFFER_CODE) ไม่ตั้ง = ไม่มีโปร
export const LIMITED_OFFER_HREF = '/api/v2/limited-offer'

export type LimitedOffer = {
  packageCode: string
  name: string
  period: string
  listBaht: number
  priceBaht: number
  percentOff: number
  /** ISO ของเวลาสิ้นสุดโค้ด (null = โค้ดไม่กำหนดวันหมด → ไม่โชว์นาฬิกา) */
  endsAt: string | null
  href: string
}

const PKG_RE = /^[A-Z0-9_]{3,40}$/
const CODE_RE = /^[A-Za-z0-9_-]{3,40}$/

/** env ครบและรูปแบบถูกเท่านั้นที่เปิดโปร — ค่าว่าง/เพี้ยน = ปิด */
export function limitedOfferConfig(pkg: unknown, code: unknown): { pkg: string; code: string } | null {
  const p = typeof pkg === 'string' ? pkg.trim() : ''
  const c = typeof code === 'string' ? code.trim() : ''
  return PKG_RE.test(p) && CODE_RE.test(c) ? { pkg: p, code: c } : null
}

const PERIOD: Record<string, string> = { '1M': 'รายเดือน', '1Y': 'รายปี' }
const TIER_NAME: Record<string, string> = { PRO: 'Mumate Pro', PLUS: 'Mumate+' }

type Priced = { tierCode: string; expire: string; listSatang: number; discountSatang: number; amountSatang: number; code: { endsAt?: unknown } | null }

/** ผลจาก priceFor → ข้อเสนอ หรือ null เมื่อไม่ใช่ข้อเสนอจริง (ไม่มีส่วนลด / ราคาเพี้ยน / ไม่ใช่แพ็กสมาชิก) */
export function limitedOfferFrom(p: Priced, pkg: string, code: string): LimitedOffer | null {
  const list = p.listSatang / 100
  const price = p.amountSatang / 100
  const name = TIER_NAME[p.tierCode]
  if (!name || !(list > 0) || !(price > 0) || !(price < list)) return null
  const endsAt = typeof p.code?.endsAt === 'string' && Number.isFinite(Date.parse(p.code.endsAt)) ? p.code.endsAt : null
  const q = new URLSearchParams({ package_code: pkg, code })
  return {
    packageCode: pkg,
    name,
    period: PERIOD[p.expire] ?? '',
    listBaht: Math.round(list),
    priceBaht: Math.round(price),
    percentOff: Math.round((1 - price / list) * 100),
    endsAt,
    href: `/v2/shop/checkout?${q.toString()}`,
  }
}

/** ฝั่ง client: ตรวจร่างที่ BFF ตอบ — อะไรไม่ครบ/เพี้ยน = ไม่มีโปร (ไม่ปั้นราคาจากค่าครึ่ง ๆ กลาง ๆ) */
export function parseOffer(j: unknown): LimitedOffer | null {
  if (!j || typeof j !== 'object') return null
  const o = j as Record<string, unknown>
  if (!o.offer || typeof o.offer !== 'object') return null
  const f = o.offer as Record<string, unknown>
  const endsAt = typeof f.endsAt === 'string' && Number.isFinite(Date.parse(f.endsAt)) ? f.endsAt : null
  if (typeof f.packageCode !== 'string' || typeof f.name !== 'string' || typeof f.href !== 'string' || !f.href.startsWith('/v2/')) return null
  if (typeof f.listBaht !== 'number' || typeof f.priceBaht !== 'number' || !(f.priceBaht > 0) || !(f.priceBaht < f.listBaht)) return null
  return {
    packageCode: f.packageCode,
    name: f.name,
    period: typeof f.period === 'string' ? f.period : '',
    listBaht: f.listBaht,
    priceBaht: f.priceBaht,
    percentOff: typeof f.percentOff === 'number' ? f.percentOff : Math.round((1 - f.priceBaht / f.listBaht) * 100),
    endsAt,
    href: f.href,
  }
}

/** เวลาที่เหลือ → "HH:MM:SS" · เกิน 1 วัน → "N วัน HH:MM:SS" · หมดแล้ว/ค่าเพี้ยน → '' */
export function formatCountdown(msLeft: number): string {
  if (!Number.isFinite(msLeft) || msLeft <= 0) return ''
  const total = Math.floor(msLeft / 1000)
  const days = Math.floor(total / 86400)
  const h = String(Math.floor((total % 86400) / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${days > 0 ? `${days} วัน ` : ''}${h}:${m}:${s}`
}
